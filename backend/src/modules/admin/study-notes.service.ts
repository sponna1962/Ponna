// Study Notes (Sept 2026, Group IV first). See schema.prisma's own
// header comment on StudyNote for the full context -- explicit request
// after a competitor review (Testbook.com has a "Study Notes" section;
// PONNA didn't). Built on syllabus content already on file
// (SyllabusSubject/SyllabusTopic, from Syllabus PDF Import) rather than
// inventing new content from nothing -- the same "Verified, Not
// Guessed" philosophy as everywhere else: AI drafts a summary from the
// REAL syllabus text on file, a human reviews and can edit before it's
// ever shown to a student. Scale is small (one call per Subject per
// language, ~15 subjects x 2 languages for Group IV) so this
// deliberately skips the batching complexity Bulk Explanation Generator
// needed for 1000+ questions -- not needed at this scale, and batching
// unrelated subjects together would only make each response harder to
// parse correctly.

import { Language } from '@prisma/client';
import { prisma } from '../../lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.7-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-3.6-flash';
// Sept 2026 — real Gemini 3.7 Flash pricing verified against Google's
// own pricing page: $0.75/M input, $3.75/M output, through the
// introductory period ending Dec 31, 2026 (same constants already
// verified and used in bulk-explanation.service.ts and
// question-audit.service.ts).
const EST_INPUT_COST_PER_1M = 0.75;
const EST_OUTPUT_COST_PER_1M = 3.75;

export class StudyNotesService {
  private async fetchWithFallback(prompt: string): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number }> {
    const requestFor = (model: string) => ({
      model,
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
        }),
      } satisfies RequestInit,
    });

    const primary = requestFor(GEMINI_MODEL);
    let response = await fetch(primary.url, primary.init);
    let model = GEMINI_MODEL;
    if (!response.ok && response.status === 503) {
      const fallback = requestFor(GEMINI_MODEL_FALLBACK);
      response = await fetch(fallback.url, fallback.init);
      model = GEMINI_MODEL_FALLBACK;
    }
    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.status} ${await response.text()}`);
    }
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

  private buildPrompt(subjectName: string, topics: string[], language: Language): string {
    const langInstruction = language === 'TA' ? 'Write entirely in Tamil.' : 'Write entirely in English.';
    return `You are writing a concise study note for a TNPSC Group - IV exam aspirant, covering the syllabus subject "${subjectName}".

The OFFICIAL syllabus content for this subject is:
${topics.map((t) => `- ${t}`).join('\n')}

Write a clear, well-organized summary note covering the key facts, concepts, and points an aspirant should know from this syllabus content -- structured with short headings and clearly separated points, exam-focused (what's likely to be asked), not a generic essay. Stay strictly within the syllabus content given above -- do not introduce topics not listed. ${langInstruction}

Respond with ONLY the note content itself, in PLAIN TEXT -- absolutely NO markdown syntax of any kind: no "**bold**", no "##" headings, no "-" or "*" bullet markers. Write headings as a short line of plain text followed by a blank line, and list items as plain lines separated by line breaks (each on its own line), never with a leading symbol. No preamble, no "Here is the note" framing.`;
  }

  /** Generates (or regenerates) a draft note for one Subject in one
   * language, built from that Subject's own SyllabusTopic content on
   * file. Always reviewed=false -- an admin must review before a
   * student ever sees it (see markReviewed()). */
  async generateForSubject(subjectId: string, language: Language): Promise<void> {
    const subject = await prisma.syllabusSubject.findUniqueOrThrow({
      where: { id: subjectId },
      include: { topics: { orderBy: { sortOrder: 'asc' } } },
    });
    const topicNames = subject.topics.map((t) => t.name);
    if (topicNames.length === 0) {
      throw new Error(`Subject "${subject.name}" has no syllabus topics on file yet -- nothing to draft a note from.`);
    }

    const prompt = this.buildPrompt(subject.name, topicNames, language);
    const { text, model, inputTokens, outputTokens } = await this.fetchWithFallback(prompt);
    // Sept 2026 (real bug fix, confirmed from a live report) — defense-
    // in-depth cleanup on top of the prompt's own "no markdown" instruction
    // above: strips any stray "**bold**"/"##"/leading "-"/"*" bullet
    // markers the model added anyway (a common habit even when told not
    // to), since the student-facing page renders this as plain text with
    // no markdown parser -- unstripped syntax showed up as literal
    // clutter (e.g. "**" characters scattered through the text),
    // confirmed unreadable in a live report.
    const cleanedText = text
      .replace(/\*\*(.*?)\*\*/g, '$1') // **bold** -> bold
      .replace(/^#{1,6}\s*/gm, '') // markdown headings
      .replace(/^[-*]\s+/gm, '') // leading bullet markers
      .replace(/\*/g, ''); // any remaining stray asterisks

    await prisma.studyNote.upsert({
      where: { subjectId_language: { subjectId, language } },
      create: { subjectId, language, content: cleanedText, model, reviewed: false },
      update: { content: cleanedText, model, reviewed: false, reviewedAt: null, generatedAt: new Date() },
    });

    console.log(`Study note generated: subject=${subject.name} language=${language} model=${model} tokens=${inputTokens}+${outputTokens} est_cost=$${((inputTokens / 1_000_000) * EST_INPUT_COST_PER_1M + (outputTokens / 1_000_000) * EST_OUTPUT_COST_PER_1M).toFixed(4)}`);
  }

  /** Generates a note for every Subject under this exam that doesn't
   * already have one, in both languages -- the "Generate All" admin
   * action. Skips (rather than fails the whole run) any single
   * subject/language combo that errors, so one bad topic list doesn't
   * block the rest. */
  async generateAllMissing(subCategoryId: string): Promise<{ generated: number; skipped: { subjectName: string; language: Language; error: string }[] }> {
    const subjects = await prisma.syllabusSubject.findMany({ where: { subCategoryId } });
    const existing = await prisma.studyNote.findMany({
      where: { subject: { subCategoryId } },
      select: { subjectId: true, language: true },
    });
    const existingKeys = new Set(existing.map((n) => `${n.subjectId}:${n.language}`));

    let generated = 0;
    const skipped: { subjectName: string; language: Language; error: string }[] = [];
    for (const subject of subjects) {
      for (const language of ['TA', 'EN'] as Language[]) {
        if (existingKeys.has(`${subject.id}:${language}`)) continue;
        try {
          await this.generateForSubject(subject.id, language);
          generated++;
        } catch (err: any) {
          skipped.push({ subjectName: subject.name, language, error: err.message ?? 'Unknown error' });
        }
      }
    }
    return { generated, skipped };
  }

  /** Admin list — every note (reviewed or not) for an exam, for the
   * review queue. */
  async listForAdmin(subCategoryId: string) {
    return prisma.studyNote.findMany({
      where: { subject: { subCategoryId } },
      include: { subject: { select: { name: true, sortOrder: true } } },
      orderBy: [{ subject: { sortOrder: 'asc' } }, { language: 'asc' }],
    });
  }

  /** Admin edit + review/publish. Content edit is optional (admin may
   * just approve the AI draft as-is). */
  async reviewNote(noteId: string, content?: string): Promise<void> {
    await prisma.studyNote.update({
      where: { id: noteId },
      data: { ...(content !== undefined ? { content } : {}), reviewed: true, reviewedAt: new Date() },
    });
  }

  /** Student-facing — only ever reviewed notes, grouped by Subject, for
   * one exam and language. */
  async listForStudent(subCategoryId: string, language: Language) {
    const notes = await prisma.studyNote.findMany({
      where: { subject: { subCategoryId }, language, reviewed: true },
      include: { subject: { select: { id: true, name: true, nameTa: true, sortOrder: true } } },
      orderBy: { subject: { sortOrder: 'asc' } },
    });
    return notes.map((n) => ({ subjectId: n.subject.id, subjectName: n.subject.name, subjectNameTa: n.subject.nameTa, content: n.content }));
  }
}

export const studyNotesService = new StudyNotesService();
