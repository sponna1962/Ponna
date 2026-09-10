// Duplicate pre-filter (Sept 2026, AI Question Audit Phase 1) — a cheap,
// dependency-free candidate finder. Exact duplicates are already prevented
// at write time by Question.contentHash (see content-hash.ts); this is for
// NEAR-duplicates (reworded/paraphrased versions) that hash matching can't
// catch. Runs entirely in-app (word-overlap similarity), scoped to the
// same Sub-Category/Category + language so it never has to scan the full
// 1.31L-question bank per target question. Only questions that clear the
// similarity threshold here are ever sent to the AI for confirmation —
// keeps the expensive step (the Gemini call) cheap and rare.
//
// Phase 2 candidate improvement (not built here): Postgres pg_trgm
// trigram similarity would be more accurate and index-backed, but needs a
// migration this sandbox can't apply directly — noted for later, not
// required for the Phase 1 pilot's accuracy goals.

import { prisma } from '../../lib/prisma';

const SIMILARITY_THRESHOLD = 0.55; // word-overlap ratio (Jaccard) above which we ask the AI to confirm
const MAX_CANDIDATES = 3;
const CANDIDATE_POOL_LIMIT = 500; // cap comparisons per target question, for performance

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'and', 'or', 'which', 'what', 'who',
  'whom', 'this', 'that', 'these', 'those', 'with', 'for', 'by', 'as', 'be', 'been', 'from', 'not', 'has', 'have',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) if (b.has(w)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DuplicateCandidate {
  id: string;
  questionText: string;
  similarity: number;
}

/** Finds up to MAX_CANDIDATES other questions that are textually similar
 * enough to be worth asking the AI "is this a near-duplicate?" — scoped to
 * the same Sub-Category (or Category, if no Sub-Category) and language.
 * Returns [] for a question with no Category/Sub-Category at all, rather
 * than comparing against the whole bank. */
export async function findDuplicateCandidates(question: {
  id: string;
  questionText: string;
  subCategoryId: string | null;
  categoryId: string | null;
  language: string;
}): Promise<DuplicateCandidate[]> {
  const scopeWhere = question.subCategoryId
    ? { subCategoryId: question.subCategoryId }
    : question.categoryId
      ? { categoryId: question.categoryId }
      : null;
  if (!scopeWhere) return [];

  const pool = await prisma.question.findMany({
    where: { ...scopeWhere, language: question.language as any, id: { not: question.id }, status: { not: 'DISABLED' } },
    select: { id: true, questionText: true },
    take: CANDIDATE_POOL_LIMIT,
  });

  const targetTokens = tokenize(question.questionText);
  return pool
    .map((p) => ({ id: p.id, questionText: p.questionText, similarity: jaccard(targetTokens, tokenize(p.questionText)) }))
    .filter((p) => p.similarity >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, MAX_CANDIDATES);
}
