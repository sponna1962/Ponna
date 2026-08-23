// Duplicate-detection utility — implements the "content hash" field described
// in §6.2/§6.3. Normalizes text before hashing so trivial formatting
// differences (extra spaces, casing, punctuation) don't create false-negative
// duplicates.

import crypto from 'crypto';

export function normalizeForHash(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?;:'"“”‘’]/g, '');
}

export function computeContentHash(fields: {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}): string {
  const normalized = [
    fields.questionText,
    fields.optionA,
    fields.optionB,
    fields.optionC,
    fields.optionD,
  ]
    .map(normalizeForHash)
    .join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}
