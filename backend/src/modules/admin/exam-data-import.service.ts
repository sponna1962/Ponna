// Exam Data Import (Sept 2026) — ONE simple tool for three TNPSC
// multi-exam TABLE documents: Scheme of Examination, Annual Planner
// (year-end tentative exam calendar), Selection Schedule (stage-wise
// dates). Deliberately kept to a SINGLE generic shape per exam --
// {label, value} fact pairs -- rather than a different form per
// document type, so the review UI never changes shape regardless of
// which document was uploaded (explicit simplicity request: "easy,
// no confusion"). The chosen documentType only changes (a) the AI
// prompt's extraction guidance and (b) which VerifiedExamFactType +
// isOfficialConfirmed the saved facts get.
//
// Same review-before-apply shape as Syllabus PDF Import: extract()
// never writes anything; applyDraft() only saves what the admin
// explicitly approved, only for exams matched to a real Sub-Category
// (checkboxes, never AI-guessed -- PDF exam names don't literally match
// internal names).

import { v2 as cloudinary } from 'cloudinary';
import { PDFParse } from 'pdf-parse';
import { prisma } from '../../lib/prisma';
import { VerifiedExamFactType } from '@prisma/client';

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

export type ExamDataDocumentType = 'SCHEME_OF_EXAMINATION' | 'ANNUAL_PLANNER' | 'SELECTION_SCHEDULE';

const DOCUMENT_TYPE_CONFIG: Record<ExamDataDocumentType, { factType: VerifiedExamFactType; isOfficialConfirmed: boolean; guidance: string }> = {
  SCHEME_OF_EXAMINATION: {
    factType: 'PAPER_STRUCTURE',
    isOfficialConfirmed: true,
    guidance:
      'This is a "Scheme of Examination" table (columns like: Name of Examination, No. of Papers, Paper Details, Standard, Descriptive/Objective, Qualifying/Scoring, No. of Questions, Marks). For each exam, extract one fact per paper as a {label, value} pair, e.g. label "Paper A - General Studies", value "Degree, Objective, Qualifying, 175 Questions". Add one final {label: "Total", value: "..."} pair with the total questions/marks if the table states them.',
  },
  ANNUAL_PLANNER: {
    factType: 'EXAM_DATE',
    isOfficialConfirmed: false,
    guidance:
      'This is an "Annual Planner" -- a year-end calendar of TENTATIVE upcoming exam dates for the following year, published before official notifications exist. For each exam, extract its planned/tentative date(s) as {label, value} pairs, e.g. label "Tentative Exam Date", value "March 2027". These are indicative only, not final -- do not invent precision the source does not state.',
  },
  SELECTION_SCHEDULE: {
    factType: 'EXAM_STAGES',
    isOfficialConfirmed: true,
    guidance:
      'This is a "Selection Schedule" listing stage-wise dates for exams (e.g. Preliminary, Main, Interview, Result). For each exam, extract one {label, value} pair per stage, e.g. label "Preliminary Examination", value "12 January 2027".',
  },
};

export interface DraftFact {
  label: string;
  value: string;
}
export interface DraftExamEntry {
  examName: string;
  facts: DraftFact[];
  subCategoryIds: string[];
}
export interface ExamDataDraft {
  documentType: ExamDataDocumentType;
  exams: DraftExamEntry[];
}

export class ExamDataImportError extends Error {}

export class ExamDataImportService {
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
    if (!GEMINI_API_KEY) throw new ExamDataImportError('GEMINI_API_KEY is not set.');

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
    if (!response.ok) throw new ExamDataImportError(`Gemini API error: ${response.status} ${await response.text()}`);

    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new ExamDataImportError('The AI response was cut off before finishing — try a shorter excerpt of the document.');
    }
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  private buildPrompt(documentType: ExamDataDocumentType, rawText: string): string {
    const trimmed = rawText.length > 60000 ? rawText.slice(0, 60000) : rawText;
    const { guidance } = DOCUMENT_TYPE_CONFIG[documentType];
    return `You are extracting data from an official TNPSC document into JSON, for an exam-prep app.

${guidance}

Group by exam: each distinct exam name mentioned (e.g. "Combined Civil Services Examination (Group IV)") is one entry with its own list of {label, value} facts. Keep labels short and consistent; keep values close to the source wording -- never invent data not present in the text.

Respond with ONLY a JSON object, no other text, no markdown fences, matching exactly:
{"exams": [{"examName": "...", "facts": [{"label": "...", "value": "..."}]}]}

Source document text:
"""
${trimmed}
"""`;
  }

  /** Step 1 — upload the PDF and AI-extract it into a DRAFT for the
   * chosen document type. subCategoryIds is always empty per exam. */
  async extract(documentType: ExamDataDocumentType, pdfBase64: string): Promise<{ pdfUrl: string; draft: ExamDataDraft }> {
    if (!pdfBase64.startsWith('data:application/pdf')) {
      throw new ExamDataImportError('Please choose a valid PDF file.');
    }
    const approxBytes = (pdfBase64.length * 3) / 4;
    if (approxBytes > 15 * 1024 * 1024) {
      throw new ExamDataImportError('PDF is too large — please choose one under 15MB.');
    }

    ensureCloudinaryConfigured();
    const upload = await cloudinary.uploader.upload(pdfBase64, {
      folder: 'ponna-exam-data-pdfs',
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
      throw new ExamDataImportError('Could not read text from this PDF — it may be a scanned image rather than real text.');
    } finally {
      await parser?.destroy();
    }
    if (!rawText || rawText.trim().length < 50) {
      throw new ExamDataImportError('This PDF has no extractable text (likely a scanned image). Try a text-based PDF.');
    }

    const aiText = await this.callGemini(this.buildPrompt(documentType, rawText));
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    let parsed: { exams: Omit<DraftExamEntry, 'subCategoryIds'>[] };
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiText);
    } catch {
      throw new ExamDataImportError(`Could not parse the AI's extraction response: ${aiText.slice(0, 300)}`);
    }

    const draft: ExamDataDraft = {
      documentType,
      exams: parsed.exams.map((e) => ({ ...e, subCategoryIds: [] })),
    };
    return { pdfUrl: upload.secure_url, draft };
  }

  private detectStage(examName: string): string | null {
    if (/preliminary/i.test(examName)) return 'Preliminary';
    if (/\bmain\b/i.test(examName)) return 'Main';
    if (/interview/i.test(examName)) return 'Interview';
    return null;
  }

  private formatFactValue(exam: DraftExamEntry): string {
    const stage = this.detectStage(exam.examName);
    const stagePrefix = stage ? `[${stage} Stage] ` : '';
    const factLines = exam.facts.map((f) => `${f.label}: ${f.value}`).join('; ');
    return `${stagePrefix}${factLines}. (Source: "${exam.examName}")`;
  }

  /** Step 2 — saves one VerifiedExamFact per Sub-Category the admin
   * checked for each exam, using the factType/isOfficialConfirmed that
   * match the draft's documentType. Exams with zero checked
   * Sub-Categories are skipped entirely. */
  async applyDraft(draft: ExamDataDraft, pdfUrl: string): Promise<{ factsCreated: number; skipped: number }> {
    const { factType, isOfficialConfirmed } = DOCUMENT_TYPE_CONFIG[draft.documentType];
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
            factType,
            value,
            sourceUrl: pdfUrl,
            verifiedAt: new Date(),
            isOfficialConfirmed,
          },
        });
        factsCreated++;
      }
    }

    return { factsCreated, skipped };
  }
}

export const examDataImportService = new ExamDataImportService();
