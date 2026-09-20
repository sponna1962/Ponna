import { CorrectOption, Difficulty, Language } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PDFParse } from 'pdf-parse';
import { prisma } from '../../lib/prisma';
import { computeContentHash, normalizeForHash } from '../../common/content-hash';

type Exam = 'TNPSC' | 'UPSC' | 'OTHER';
type RequestedDifficulty = 'BASIC' | 'MODERATE' | 'ADVANCED' | 'EXPERT';
type QuestionType =
  | 'STANDARD_MCq'
  | 'STATEMENT_BASED'
  | 'ASSERTION_REASON'
  | 'MATCHING'
  | 'CHRONOLOGY'
  | 'INCORRECT_STATEMENT'
  | 'APPLICATION';

interface GeneratedQuestion {
  questionTamil: string;
  questionEnglish: string;
  optionsTamil: [string, string, string, string];
  optionsEnglish: [string, string, string, string];
  correctOption: CorrectOption;
  explanationTamil: string;
  explanationEnglish: string;
  questionType: QuestionType;
  knowledgePoint: string;
  difficulty: RequestedDifficulty;
  sourceBasis: string;
}

interface GeneratorRequest {
  sourceText: string;
  count: number;
  exam: Exam;
  difficulty: RequestedDifficulty;
  questionTypes?: QuestionType[];
  subCategoryId?: string;
  subjectId?: string;
  syllabusTopicId?: string;
  sourceName?: string;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_QUESTION_MODEL || 'gemini-3.7-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_QUESTION_FALLBACK_MODEL || 'gemini-3.6-flash';
const MAX_SOURCE_CHARS = 120000;
const BATCH_SIZE = 20;

const EST_INPUT_COST_PER_1M = 0.75;
const EST_OUTPUT_COST_PER_1M = 3.75;

function cleanJson(text: string): string {
  const fenced = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/i);
  return (fenced?.[1] ?? text).trim();
}

function parseArray(text: string): any[] {
  const cleaned = cleanJson(text);
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('Gemini did not return a JSON array.');
  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Gemini returned an invalid question list.');
  return parsed;
}

function normalizeDifficulty(value: unknown): RequestedDifficulty {
  const v = String(value ?? '').toUpperCase();
  if (v === 'BASIC' || v === 'MODERATE' || v === 'ADVANCED' || v === 'EXPERT') return v;
  return 'ADVANCED';
}

function dbDifficulty(value: RequestedDifficulty): Difficulty {
  return value === 'BASIC' || value === 'MODERATE' ? Difficulty.MEDIUM : Difficulty.HARD;
}

function normalizeType(value: unknown): QuestionType {
  const v = String(value ?? '').toUpperCase().replace(/[- ]/g, '_');
  if (
    v === 'STATEMENT_BASED' ||
    v === 'ASSERTION_REASON' ||
    v === 'MATCHING' ||
    v === 'CHRONOLOGY' ||
    v === 'INCORRECT_STATEMENT' ||
    v === 'APPLICATION'
  ) return v;
  return 'STANDARD_MCq';
}

function tokens(text: string): Set<string> {
  return new Set(
    normalizeForHash(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((x) => x.length > 1),
  );
}

function similarity(a: string, b: string): number {
  const aa = tokens(a);
  const bb = tokens(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  for (const t of aa) if (bb.has(t)) intersection++;
  return intersection / (aa.size + bb.size - intersection);
}

function validateQuestion(q: any): GeneratedQuestion {
  const ta = Array.isArray(q.optionsTamil) ? q.optionsTamil : [];
  const en = Array.isArray(q.optionsEnglish) ? q.optionsEnglish : [];
  if (
    typeof q.questionTamil !== 'string' ||
    typeof q.questionEnglish !== 'string' ||
    ta.length !== 4 ||
    en.length !== 4 ||
    typeof q.explanationTamil !== 'string' ||
    typeof q.explanationEnglish !== 'string' ||
    !['A', 'B', 'C', 'D'].includes(q.correctOption)
  ) {
    throw new Error('Gemini returned a malformed bilingual question.');
  }
  if (ta.some((x: unknown) => typeof x !== 'string') || en.some((x: unknown) => typeof x !== 'string')) {
    throw new Error('Gemini returned invalid options.');
  }
  return {
    questionTamil: q.questionTamil.trim(),
    questionEnglish: q.questionEnglish.trim(),
    optionsTamil: ta.map((x: string) => x.trim()) as GeneratedQuestion['optionsTamil'],
    optionsEnglish: en.map((x: string) => x.trim()) as GeneratedQuestion['optionsEnglish'],
    correctOption: q.correctOption as CorrectOption,
    explanationTamil: q.explanationTamil.trim(),
    explanationEnglish: q.explanationEnglish.trim(),
    questionType: normalizeType(q.questionType),
    knowledgePoint: String(q.knowledgePoint ?? '').trim(),
    difficulty: normalizeDifficulty(q.difficulty),
    sourceBasis: String(q.sourceBasis ?? '').trim(),
  };
}

function generationPrompt(input: GeneratorRequest, batchCount: number, source: string): string {
  const types = (input.questionTypes?.length ? input.questionTypes : [
    'STATEMENT_BASED',
    'INCORRECT_STATEMENT',
    'MATCHING',
    'CHRONOLOGY',
    'APPLICATION',
  ]).join(', ');

  return `You are an expert TNPSC/UPSC examination question setter.

SOURCE MATERIAL IS THE ONLY FACTUAL AUTHORITY:
"""
${source}
"""

Create exactly ${batchCount} NEW multiple-choice questions from the source material.

Exam target: ${input.exam}
Difficulty: ${input.difficulty}
Allowed question types: ${types}

NON-NEGOTIABLE RULES:
1. Use only facts/concepts supported by the source. Never invent a fact.
2. Every question must have exactly ONE unambiguously correct option.
3. All four options must be plausible; avoid silly distractors.
4. Tamil and English must express exactly the same meaning.
5. Give a clear, factually correct explanation in BOTH languages.
6. Prefer reasoning, comparison, chronology, statement combinations, exceptions and application over simple recall when the source supports them.
7. Do not create two questions testing the same knowledge point.
8. Do not merely change wording of another question.
9. For TNPSC/UPSC level, avoid giveaway wording and avoid "all of the above/none of the above".
10. If the source does not support a difficult question, make a sounder question rather than inventing difficulty.
11. The answer letter must refer to the same position in Tamil and English options.
12. Keep Tamil natural and exam-appropriate; do not mix unnecessary English into Tamil.
13. Keep English precise and grammatical.
14. "sourceBasis" must briefly identify the source fact/concept used.

Return ONLY a JSON array. No markdown. Each object must have exactly:
{
 "questionTamil": "...",
 "questionEnglish": "...",
 "optionsTamil": ["A...", "B...", "C...", "D..."],
 "optionsEnglish": ["A...", "B...", "C...", "D..."],
 "correctOption": "A|B|C|D",
 "explanationTamil": "...",
 "explanationEnglish": "...",
 "questionType": "...",
 "knowledgePoint": "...",
 "difficulty": "...",
 "sourceBasis": "..."
}`;
}

function verificationPrompt(source: string, questions: GeneratedQuestion[]): string {
  return `Act as a strict final examiner and fact-checker.

SOURCE MATERIAL:
"""
${source}
"""

Review the following generated questions. For EVERY question:
- Verify the correct answer from the source.
- Verify there is exactly one correct answer.
- Verify Tamil and English are semantically equivalent.
- Verify every option is correctly translated.
- Verify both explanations are correct and actually explain the answer.
- Reject questions whose answer cannot be established from the source.
- Reject questions that test the same knowledge point as another question in this batch.
- Preserve a question only if it passes ALL checks.
- If a small wording/translation defect can be fixed without changing the fact, correct it.
- Never introduce information not supported by the source.

Return ONLY a JSON array containing the final accepted/corrected questions in the same schema. It is acceptable to return fewer questions than supplied. Do not add commentary.

QUESTIONS:
${JSON.stringify(questions)}`;
}

export class AiQuestionGeneratorService {
  private async callGemini(prompt: string): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured.');

    const request = (model: string) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 12000 },
        }),
      } satisfies RequestInit,
    });

    let model = GEMINI_MODEL;
    let response = await fetch(request(model).url, request(model).init);
    if (!response.ok && (response.status === 503 || response.status === 429)) {
      model = GEMINI_FALLBACK_MODEL;
      response = await fetch(request(model).url, request(model).init);
    }
    if (!response.ok) throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    return {
      text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? '',
      model,
      inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }

  private async findPotentialDuplicates(questions: GeneratedQuestion[], subCategoryId?: string): Promise<Set<number>> {
    const existing = await prisma.question.findMany({
      where: {
        ...(subCategoryId ? { subCategoryId } : {}),
        status: { not: 'DISABLED' },
      },
      select: { questionText: true, optionA: true, optionB: true, optionC: true, optionD: true, language: true },
      take: 20000,
      orderBy: { createdAt: 'desc' },
    });

    const duplicateIndexes = new Set<number>();
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const candidates = existing.filter((x) => x.language === Language.TA);
      if (candidates.some((x) => similarity(q.questionTamil, x.questionText) >= 0.82)) duplicateIndexes.add(i);
      if (i > 0 && questions.slice(0, i).some((p) => similarity(q.questionTamil, p.questionTamil) >= 0.82)) duplicateIndexes.add(i);
    }
    return duplicateIndexes;
  }

  async generate(input: GeneratorRequest): Promise<{ runId: string; generated: number; skipped: number; model: string; estimatedCostUsd: number }> {
    if (!input.sourceText?.trim()) throw new Error('sourceText is required.');
    if (input.sourceText.length > MAX_SOURCE_CHARS) throw new Error(`Source text is too large. Maximum is ${MAX_SOURCE_CHARS} characters.`);
    if (!Number.isInteger(input.count) || input.count < 1 || input.count > 100) throw new Error('count must be between 1 and 100.');

    const run = await prisma.aiQuestionGenerationRun.create({
      data: {
        label: input.sourceName?.trim() || `${input.exam} ${input.difficulty} question generation`,
        exam: input.exam,
        requestedDifficulty: input.difficulty,
        requestedCount: input.count,
        sourceName: input.sourceName ?? null,
        sourceText: input.sourceText,
        model: GEMINI_MODEL,
        status: 'RUNNING',
      },
    });

    let totalGenerated = 0;
    let skipped = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastModel = GEMINI_MODEL;

    try {
      for (let offset = 0; offset < input.count; offset += BATCH_SIZE) {
        const target = Math.min(BATCH_SIZE, input.count - offset);
        const generatedResponse = await this.callGemini(generationPrompt(input, target, input.sourceText));
        totalInputTokens += generatedResponse.inputTokens;
        totalOutputTokens += generatedResponse.outputTokens;
        lastModel = generatedResponse.model;
        const generatedRaw = parseArray(generatedResponse.text);
        let generated: GeneratedQuestion[] = [];
        for (const item of generatedRaw) {
          try { generated.push(validateQuestion(item)); } catch { skipped++; }
        }

        const verificationResponse = await this.callGemini(verificationPrompt(input.sourceText, generated));
        totalInputTokens += verificationResponse.inputTokens;
        totalOutputTokens += verificationResponse.outputTokens;
        lastModel = verificationResponse.model;
        const verifiedRaw = parseArray(verificationResponse.text);
        const verified: GeneratedQuestion[] = [];
        for (const item of verifiedRaw) {
          try { verified.push(validateQuestion(item)); } catch { skipped++; }
        }

        const duplicateIndexes = await this.findPotentialDuplicates(verified, input.subCategoryId);
        for (let i = 0; i < verified.length; i++) {
          if (duplicateIndexes.has(i)) {
            skipped++;
            continue;
          }
          const q = verified[i];
          const groupId = randomUUID();
          const batchId = run.id;
          const dbDiff = dbDifficulty(input.difficulty);
          const commonNotes = JSON.stringify({
            aiGenerated: true,
            generationRunId: run.id,
            exam: input.exam,
            requestedDifficulty: input.difficulty,
            questionType: q.questionType,
            knowledgePoint: q.knowledgePoint,
            sourceBasis: q.sourceBasis,
            verification: 'gemini-final-review',
          });

          const taHash = computeContentHash({
            questionText: q.questionTamil,
            optionA: q.optionsTamil[0],
            optionB: q.optionsTamil[1],
            optionC: q.optionsTamil[2],
            optionD: q.optionsTamil[3],
          });
          const enHash = computeContentHash({
            questionText: q.questionEnglish,
            optionA: q.optionsEnglish[0],
            optionB: q.optionsEnglish[1],
            optionC: q.optionsEnglish[2],
            optionD: q.optionsEnglish[3],
          });

          const exists = await prisma.question.findFirst({
            where: { contentHash: { in: [taHash, enHash] } },
            select: { id: true },
          });
          if (exists) {
            skipped++;
            continue;
          }

          await prisma.$transaction([
            prisma.question.create({
              data: {
                questionText: q.questionTamil,
                optionA: q.optionsTamil[0],
                optionB: q.optionsTamil[1],
                optionC: q.optionsTamil[2],
                optionD: q.optionsTamil[3],
                correctOption: q.correctOption,
                explanationTa: q.explanationTamil,
                explanationEn: q.explanationEnglish,
                language: Language.TA,
                translationGroupId: groupId,
                subCategoryId: input.subCategoryId,
                subjectId: input.subjectId,
                syllabusTopicId: input.syllabusTopicId,
                sourceType: 'ORIGINAL',
                sourceName: input.sourceName ?? 'AI-generated from supplied study material',
                internalNotes: commonNotes,
                difficulty: dbDiff,
                aiSuggestedDifficulty: dbDiff,
                aiConfidence: 85,
                status: 'DRAFT',
                contentHash: taHash,
                sourceBatchId: batchId,
              },
            }),
            prisma.question.create({
              data: {
                questionText: q.questionEnglish,
                optionA: q.optionsEnglish[0],
                optionB: q.optionsEnglish[1],
                optionC: q.optionsEnglish[2],
                optionD: q.optionsEnglish[3],
                correctOption: q.correctOption,
                explanationTa: q.explanationTamil,
                explanationEn: q.explanationEnglish,
                language: Language.EN,
                translationGroupId: groupId,
                subCategoryId: input.subCategoryId,
                subjectId: input.subjectId,
                syllabusTopicId: input.syllabusTopicId,
                sourceType: 'ORIGINAL',
                sourceName: input.sourceName ?? 'AI-generated from supplied study material',
                internalNotes: commonNotes,
                difficulty: dbDiff,
                aiSuggestedDifficulty: dbDiff,
                aiConfidence: 85,
                status: 'DRAFT',
                contentHash: enHash,
                sourceBatchId: batchId,
              },
            }),
          ]);
          totalGenerated++;
        }
      }

      const estimatedCostUsd = (totalInputTokens / 1_000_000) * EST_INPUT_COST_PER_1M
        + (totalOutputTokens / 1_000_000) * EST_OUTPUT_COST_PER_1M;

      await prisma.aiQuestionGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          generatedCount: totalGenerated,
          skippedCount: skipped,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          estimatedCostUsd,
          model: lastModel,
          completedAt: new Date(),
        },
      });

      return { runId: run.id, generated: totalGenerated, skipped, model: lastModel, estimatedCostUsd };
    } catch (error: any) {
      await prisma.aiQuestionGenerationRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', generatedCount: totalGenerated, skippedCount: skipped, errorMessage: error.message ?? 'Generation failed', completedAt: new Date() },
      });
      throw error;
    }
  }

  async extractPdf(buffer: Buffer): Promise<string> {
    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text?.trim() ?? '';
      if (text.length < 50) throw new Error('The PDF has no usable text. It may be scanned/image-only; OCR is not enabled in this backend endpoint yet.');
      return text;
    } finally {
      await parser?.destroy();
    }
  }

  async getRun(runId: string) {
    return prisma.aiQuestionGenerationRun.findUniqueOrThrow({ where: { id: runId } });
  }

  async listRuns(limit = 50) {
    return prisma.aiQuestionGenerationRun.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(limit, 1), 100) });
  }
}

export const aiQuestionGeneratorService = new AiQuestionGeneratorService();
