// Exam Pattern Import (Sept 2026) — same review-before-apply shape as
// Syllabus PDF Import (syllabus-import.service.ts), for a DIFFERENT
// source document type: an official "Scheme of Examination" table that
// lists many exams at once (Papers, Standard, Objective/Descriptive,
// Qualifying/Scoring, Question count, Marks) rather than one exam's
// syllabus content. Never touches SyllabusSubject/SyllabusTopic --
// writes PAPER_STRUCTURE VerifiedExamFacts instead, one per exam the
// admin explicitly matches to a real Sub-Category and approves.
//
// The AI extracts STRUCTURED fields per exam (paper labels, standard,
// type, qualifying/scoring, question counts, marks) -- it does NOT
// write the final fact text itself. The human-readable VerifiedExamFact
// value is composed in CODE from those structured fields (see
// formatFactValue), so the saved fact's wording is deterministic and
// never an AI paraphrase of the official numbers.
//
// Matching an extracted row to a real ExamSubCategory is a judgment
// call the AI cannot make reliably (PDF exam names like "Combined Civil
// Services Examination (Group IV)" don't literally match internal
// names like "குரூப் 4 - வி.ஏ.ஓ்."), so extract() never guesses a
// subCategoryIds -- the frontend presents checkboxes (the same taxonomy
// list every other admin picker uses) for the admin to confirm or skip
// each row.

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

export interface DraftPaper {
  label: string; // e.g. "A", "I", "II"
  paperName: string; // e.g. "General Studies", "Tamil Eligibility Test"
  standard: string | null; // e.g. "SSLC", "Degree", "Degree / PG Degree"
  type: string | null; // "Objective" | "Descriptive"
  qualifyingOrScoring: string | null; // "Qualifying" | "Scoring"
  questionCount: number | null;
  marks: number | null;
}
export interface DraftExamPattern {
  examName: string; // exact text from the PDF, e.g. "Combined Civil Services Examination (Group IV)"
  papers: DraftPaper[];
  totalQuestions: number | null;
  totalMarks: number | null;
  // Sept 2026 — an array, not a single id: some PDF rows genuinely apply
  // to several exams at once (e.g. a combined Preliminary stage shared
  // by Group IA/IB/IC/VI, even though their Main exams differ). The
  // admin checks every Sub-Category this pattern actually applies to;
  // extract() always leaves this empty — the admin fills it in.
  subCategoryIds: string[];
}
export interface ExamPatternDraft {
  exams: DraftExamPattern[];
}

export class ExamPatternImportError extends Error {}

export class ExamPatternImportService {
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
    if (!GEMINI_API_KEY) throw new ExamPatternImportError('GEMINI_API_KEY is not set.');

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
    if (!response.ok) throw new ExamPatternImportError(`Gemini API error: ${response.status} ${await response.text()}`);

    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new ExamPatternImportError('The AI response was cut off before finishing — try a shorter excerpt of the table.');
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private buildPrompt(rawText: string): string {
    const trimmed = rawText.length > 60000 ? rawText.slice(0, 60000) : rawText;
    return `You are extracting rows from an official TNPSC "Scheme of Examination" table (columns: Name of the Examination, No. of Papers, Paper Details [label + paper name], Standard, Descriptive/Objective, Qualifying/Scoring, No. of Questions, Marks) into JSON, for an exam-prep app.

Each distinct "Name of the Examination" (e.g. "Combined Civil Services Examination (Group IV)") is one entry, with one row per Paper under it (a Paper's label is like "A", "I", "II" — sub-parts like "B. General Studies" and "B. Aptitude and Mental Ability" under the same Roman numeral are still separate paper rows, using their own letter).

For totals: use the table's own explicit "Total" row for that exam when present (totalQuestions, totalMarks). If a paper's own row has a dash "--" or blank for question count (common for Descriptive/Interview-only papers), set questionCount to null, not 0.

Respond with ONLY a JSON object, no other text, no markdown fences, matching exactly:
{"exams": [{"examName": "...", "papers": [{"label": "...", "paperName": "...", "standard": "... or null", "type": "Objective or Descriptive or null", "qualifyingOrScoring": "Qualifying or Scoring or null", "questionCount": number or null, "marks": number or null}], "totalQuestions": number or null, "totalMarks": number or null}]}

Source table text:
"""
${trimmed}
"""`;
  }

  /** Step 1 — upload the PDF and AI-extract the table into a DRAFT.
   * subCategoryIds is always empty on every extracted exam — the admin
   * matches each one explicitly before anything is saved. */
  async extract(pdfBase64: string): Promise<{ pdfUrl: string; draft: ExamPatternDraft }> {
    if (!pdfBase64.startsWith('data:application/pdf')) {
      throw new ExamPatternImportError('Please choose a valid PDF file.');
    }
    const approxBytes = (pdfBase64.length * 3) / 4;
    if (approxBytes > 15 * 1024 * 1024) {
      throw new ExamPatternImportError('PDF is too large — please choose one under 15MB.');
    }

    ensureCloudinaryConfigured();
    const upload = await cloudinary.uploader.upload(pdfBase64, {
      folder: 'ponna-exam-pattern-pdfs',
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
    } catch {
      throw new ExamPatternImportError('Could not read text from this PDF — it may be a scanned image rather than real text.');
    } finally {
      await parser?.destroy();
    }
    if (!rawText || rawText.trim().length < 50) {
      throw new ExamPatternImportError('This PDF has no extractable text (likely a scanned image). Try a text-based PDF.');
    }

    const aiText = await this.callGemini(this.buildPrompt(rawText));
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    let parsed: { exams: Omit<DraftExamPattern, 'subCategoryIds'>[] };
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);
    } catch {
      throw new ExamPatternImportError(`Could not parse the AI's extraction response: ${aiText.slice(0, 300)}`);
    }

    const draft: ExamPatternDraft = {
      exams: parsed.exams.map((e) => ({ ...e, subCategoryIds: [] })),
    };
    return { pdfUrl: upload.secure_url, draft };
  }

  /** Deterministic, code-composed fact text — never an AI paraphrase of
   * the official numbers. */
  private formatFactValue(exam: DraftExamPattern): string {
    const paperLines = exam.papers
      .map((p) => {
        const bits = [p.standard, p.type, p.qualifyingOrScoring, p.questionCount != null ? `${p.questionCount} Questions` : null, p.marks != null ? `${p.marks} Marks` : null]
          .filter(Boolean)
          .join(', ');
        return `Paper ${p.label} - ${p.paperName}${bits ? ` (${bits})` : ''}`;
      })
      .join('; ');
    const totals = [exam.totalQuestions != null ? `${exam.totalQuestions} Questions` : null, exam.totalMarks != null ? `${exam.totalMarks} Marks` : null].filter(Boolean).join(', ');
    return `${exam.papers.length} Paper(s) — ${paperLines}.${totals ? ` Total: ${totals}.` : ''}`;
  }

  /** Step 2 — saves one PAPER_STRUCTURE VerifiedExamFact per Sub-Category
   * the admin checked for each exam (subCategoryIds), so a pattern
   * shared by several exams (e.g. a combined Preliminary stage) creates
   * the same fact for each of them. Exams left with zero checked
   * Sub-Categories are skipped entirely. */
  async applyDraft(draft: ExamPatternDraft, pdfUrl: string): Promise<{ factsCreated: number; skipped: number }> {
    let factsCreated = 0;
    let skipped = 0;

    for (const exam of draft.exams) {
      if (!exam.subCategoryIds || exam.subCategoryIds.length === 0) {
        skipped++;
        continue;
      }
      const value = this.formatFactValue(exam);
      for (const subCategoryId of exam.subCategoryIds) {
        await prisma.verifiedExamFact.create({
          data: {
            subCategoryId,
            factType: 'PAPER_STRUCTURE',
            value,
            sourceUrl: pdfUrl,
            verifiedAt: new Date(),
            isOfficialConfirmed: true,
          },
        });
        factsCreated++;
      }
    }

    return { factsCreated, skipped };
  }
}

export const examPatternImportService = new ExamPatternImportService();
