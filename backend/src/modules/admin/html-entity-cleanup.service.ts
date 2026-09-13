// HTML Entity Cleanup (Sept 2026) — a real data-quality issue found by
// inspection, distinct from AI Question Audit: some questions (likely
// copy-pasted from web sources) contain literal, undecoded HTML entity
// codes like "&deg;" or "&sup2;" instead of the actual symbols (° / ²)
// they represent, e.g. "E&deg; = 0.80 V" instead of "E° = 0.80 V".
//
// Deliberately NOT part of AI Question Audit: decoding a known HTML
// entity to its one true character is a fully deterministic, lossless
// transformation (the same table browsers themselves use) -- it needs
// no AI judgment call at all, and doing it via AI would only add cost
// and a small chance of the AI "helpfully" changing something else
// nearby. A plain string search-and-replace, scanning EVERY question
// (not a stratified sample) is both cheaper and more reliable here.

import { prisma } from '../../lib/prisma';

// The common named entities actually seen in this question bank so
// far, plus the standard XML-safe ones. Extend this table if a scan
// turns up others -- deliberately NOT using a general HTML-entity
// decoding library here, so every entity this tool touches is one a
// human has actually reviewed and confirmed maps to exactly one
// correct character for this content (degree signs, superscripts,
// basic escaping) -- not a blanket decode of anything that looks like
// an entity, which risks mangling text that only coincidentally
// contains an "&word;" looking substring.
const ENTITY_MAP: Record<string, string> = {
  '&deg;': '°',
  '&sup2;': '²',
  '&sup3;': '³',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&times;': '×',
  '&divide;': '÷',
  '&rarr;': '→',
  '&larr;': '←',
  '&micro;': 'µ',
  '&plusmn;': '±',
};

const FIELDS = ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'explanationTa', 'explanationEn'] as const;
type Field = (typeof FIELDS)[number];

export interface EntityIssue {
  questionId: string;
  field: Field;
  before: string;
  after: string;
}

export class HtmlEntityCleanupService {
  private decode(text: string): string {
    let result = text;
    for (const [entity, char] of Object.entries(ENTITY_MAP)) {
      result = result.split(entity).join(char);
    }
    return result;
  }

  private hasAnyEntity(text: string | null): boolean {
    if (!text) return false;
    return Object.keys(ENTITY_MAP).some((entity) => text.includes(entity));
  }

  /** Scans every question (not a sample) for any of the known entity
   * codes, across all 7 text fields. Read-only -- returns the list for
   * admin review before anything is written. */
  async scan(): Promise<EntityIssue[]> {
    const pattern = Object.keys(ENTITY_MAP)
      .map((e) => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    const rows = await prisma.$queryRawUnsafe<{ id: string } & Record<Field, string | null>>(
      `SELECT id, "questionText", "optionA", "optionB", "optionC", "optionD", "explanationTa", "explanationEn"
       FROM "Question"
       WHERE "questionText" ~ $1 OR "optionA" ~ $1 OR "optionB" ~ $1 OR "optionC" ~ $1 OR "optionD" ~ $1
          OR "explanationTa" ~ $1 OR "explanationEn" ~ $1`,
      pattern,
    );

    const issues: EntityIssue[] = [];
    for (const row of rows as unknown as ({ id: string } & Record<Field, string | null>)[]) {
      for (const field of FIELDS) {
        const before = row[field];
        if (this.hasAnyEntity(before)) {
          issues.push({ questionId: row.id, field, before: before as string, after: this.decode(before as string) });
        }
      }
    }
    return issues;
  }

  /** Applies the decode to every field flagged by scan(). Deterministic
   * and lossless -- see this file's header comment for why this
   * doesn't need admin-per-question review the way an AI suggestion
   * does. Groups by questionId so each question is a single update. */
  async fixAll(): Promise<{ questionsFixed: number; fieldsFixed: number }> {
    const issues = await this.scan();
    const byQuestion = new Map<string, EntityIssue[]>();
    for (const issue of issues) {
      const list = byQuestion.get(issue.questionId) ?? [];
      list.push(issue);
      byQuestion.set(issue.questionId, list);
    }

    for (const [questionId, fieldIssues] of byQuestion) {
      const data: Record<string, string> = {};
      for (const issue of fieldIssues) data[issue.field] = issue.after;
      await prisma.question.update({ where: { id: questionId }, data: { ...data, updatedAt: new Date() } });
    }

    return { questionsFixed: byQuestion.size, fieldsFixed: issues.length };
  }
}

export const htmlEntityCleanupService = new HtmlEntityCleanupService();
