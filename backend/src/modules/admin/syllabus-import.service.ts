// Syllabus PDF Import (Sept 2026) — admin uploads an official TNPSC
// syllabus PDF, the system extracts + AI-structures it into a DRAFT
// (Subject -> Topic, matching the existing SyllabusSubject/SyllabusTopic
// schema), and the admin reviews/edits/approves before anything is
// actually saved. Matches this codebase's established "Verify, Don't
// Guess" + Notification-Import-style review-before-apply pattern —
// extract() never writes to SyllabusSubject/SyllabusTopic itself; only
// applyDraft() does, and only with whatever the admin actually approved
// (which may differ from the AI's first draft).
//
// Deliberately does NOT store/enforce unit-wise question counts — TNPSC's
// own syllabus PDFs explicitly call that distribution "only indicative,"
// so it's surfaced to the admin as context only, never saved as a
// constraint (see SyllabusTopic.description's own schema comment).
//
// Reuses Cloudinary (already configured for profile photos) for the PDF
// file itself, and the same Gemini REST + retry/fallback pattern already
// established in ai/classification.service.ts and
// audit/question-audit.service.ts — same GEMINI_API_KEY, no new provider.

import { v2 as cloudinary } from 'cloudinary';
import { PDFParse } from 'pdf-parse';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';

let cloudinaryConfigured = false;
function ensureCloudinaryConfigured() {
  if (cloudinaryConfigured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary is not configured — set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  cloudinaryConfigured = true;
}

export interface DraftTopic {
  name: string;
  nameTa: string | null;
  description: string | null;
}
export interface DraftSubject {
  name: string;
  nameTa: string | null;
  topics: DraftTopic[];
}
export interface SyllabusDraft {
  subjects: DraftSubject[];
  eligibilityStandard: string | null; // e.g. "SSLC Standard" — for the ELIGIBILITY VerifiedExamFact, if identifiable
}

export class SyllabusImportError extends Error {}

export class SyllabusImportService {
  private async fetchWithRetry(url: string, init: RequestInit, maxAttempts = 2): Promise<Response> {
    const delayMs = 2000;
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(url, init);
      if (response.ok) return response;
      const bodyText = await response.text();
      const isRetryable = response.status === 503 || response.status === 429;
      if (!isRetryable || attempt === maxAttempts - 1) {
        return new Response(bodyText, { status: response.status, statusText: response.statusText });
      }
      lastResponse = response;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return lastResponse!;
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!GEMINI_API_KEY) throw new SyllabusImportError('GEMINI_API_KEY is not set.');

    const requestFor = (model: string) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 16000 },
        }),
      } satisfies RequestInit,
    });

    const primary = requestFor(GEMINI_MODEL);
    let response = await this.fetchWithRetry(primary.url, primary.init);
    if (!response.ok && response.status === 503) {
      const fallback = requestFor(GEMINI_MODEL_FALLBACK);
      response = await this.fetchWithRetry(fallback.url, fallback.init, 1);
    }
    if (!response.ok) throw new SyllabusImportError(`Gemini API error: ${response.status} ${await response.text()}`);

    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new SyllabusImportError(
        'The AI response was cut off before finishing — this syllabus PDF has too much content for one pass. Try a shorter/single-paper PDF, or contact support to raise the output limit.',
      );
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private buildPrompt(rawText: string): string {
    // Syllabus PDFs can be long and often repeat the same content in both
    // English and Tamil — truncate defensively so a single call stays
    // within a reasonable token budget rather than failing outright.
    const trimmed = rawText.length > 60000 ? rawText.slice(0, 60000) : rawText;

    return `You are structuring an official TNPSC (or similar Indian state PSC) exam syllabus PDF's extracted text into JSON, for a student exam-prep app.

Structure:
- Each major exam SECTION (e.g. "General Studies", "Aptitude and Mental Ability", "Tamil Eligibility Test", "General English") is a SUBJECT.
- Each numbered Unit within a section (e.g. "Unit I: General Science", "Unit IV: Indian Polity") is a TOPIC under that subject.
- For each topic, put its detailed within-unit content (the dash-separated list of specific items) into "description" — keep it close to the source wording, don't invent content that isn't in the text.
- If the SAME content appears in both English and Tamil in the source (a full bilingual duplicate), use the English version for "name"/"description" and put the Tamil unit name in "nameTa". If a subject/section is Tamil-language-specific (e.g. a Tamil grammar/literature paper) and has no English equivalent in the source, put the Tamil name in "name" and leave "nameTa" null.
- IGNORE any literal question-count numbers like "(5 Questions)" next to unit names — do NOT put them in name or description. TNPSC's own syllabus explicitly calls this distribution "only indicative," so it must not be treated as fixed data.
- Also identify the overall "Standard" or qualification level this paper/exam is set at (e.g. "SSLC Standard", "Degree Standard") if stated, as "eligibilityStandard" — null if not clearly stated.

Respond with ONLY a JSON object, no other text, no markdown fences, matching exactly:
{"subjects": [{"name": "...", "nameTa": "... or null", "topics": [{"name": "...", "nameTa": "... or null", "description": "... or null"}]}], "eligibilityStandard": "... or null"}

Source text:
"""
${trimmed}
"""`;
  }

  /** Step 1 — upload the PDF (Cloudinary) and AI-structure it into a
   * DRAFT. Does NOT touch SyllabusSubject/SyllabusTopic at all. */
  async extract(pdfBase64: string): Promise<{ pdfUrl: string; draft: SyllabusDraft }> {
    if (!pdfBase64.startsWith('data:application/pdf')) {
      throw new SyllabusImportError('Please choose a valid PDF file.');
    }
    const approxBytes = (pdfBase64.length * 3) / 4;
    if (approxBytes > 15 * 1024 * 1024) {
      throw new SyllabusImportError('PDF is too large — please choose one under 15MB.');
    }

    ensureCloudinaryConfigured();
    const upload = await cloudinary.uploader.upload(pdfBase64, {
      folder: 'ponna-syllabus-pdfs',
      resource_type: 'raw',
    });

    const base64Content = pdfBase64.split(',')[1] ?? '';
    const buffer = Buffer.from(base64Content, 'base64');
    let rawText: string;
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      rawText = result.text;
    } catch (err) {
      throw new SyllabusImportError('Could not read text from this PDF — it may be a scanned image rather than real text.');
    } finally {
      await parser?.destroy();
    }
    if (!rawText || rawText.trim().length < 50) {
      throw new SyllabusImportError('This PDF has no extractable text (likely a scanned image). Try a text-based PDF.');
    }

    const aiText = await this.callGemini(this.buildPrompt(rawText));
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    let draft: SyllabusDraft;
    try {
      draft = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);
    } catch {
      throw new SyllabusImportError(`Could not parse the AI's structuring response: ${aiText.slice(0, 300)}`);
    }

    return { pdfUrl: upload.secure_url, draft };
  }

  /** Step 2 — saves whatever the admin actually approved (may have been
   * edited from the AI's first draft) into the real schema. Upserts by
   * name (matching this codebase's own established idempotent-seeding
   * convention) — re-running with the same names updates in place,
   * never duplicates. */
  async applyDraft(
    subCategoryId: string,
    draft: SyllabusDraft,
    pdfUrl: string,
  ): Promise<{ subjectsCreated: number; topicsCreated: number }> {
    let subjectsCreated = 0;
    let topicsCreated = 0;

    for (const [subjectIndex, subjectDraft] of draft.subjects.entries()) {
      if (!subjectDraft.name?.trim()) continue;
      const subject = await prisma.syllabusSubject.upsert({
        where: { subCategoryId_name: { subCategoryId, name: subjectDraft.name } },
        create: { subCategoryId, name: subjectDraft.name, nameTa: subjectDraft.nameTa || null, sortOrder: subjectIndex },
        update: { nameTa: subjectDraft.nameTa || null, sortOrder: subjectIndex },
      });
      subjectsCreated++;

      for (const [topicIndex, topicDraft] of subjectDraft.topics.entries()) {
        if (!topicDraft.name?.trim()) continue;
        await prisma.syllabusTopic.upsert({
          where: { subjectId_name: { subjectId: subject.id, name: topicDraft.name } },
          create: {
            subjectId: subject.id,
            name: topicDraft.name,
            nameTa: topicDraft.nameTa || null,
            description: topicDraft.description || null,
            sortOrder: topicIndex,
          },
          update: {
            nameTa: topicDraft.nameTa || null,
            description: topicDraft.description || null,
            sortOrder: topicIndex,
          },
        });
        topicsCreated++;
      }
    }

    if (draft.eligibilityStandard) {
      await prisma.verifiedExamFact.create({
        data: {
          subCategoryId,
          factType: 'ELIGIBILITY',
          value: draft.eligibilityStandard,
          sourceUrl: pdfUrl,
          verifiedAt: new Date(),
          isOfficialConfirmed: true, // admin explicitly approved this draft before it reached here
        },
      });
    }

    return { subjectsCreated, topicsCreated };
  }
}

export const syllabusImportService = new SyllabusImportService();
