// Verification Tiers (Ask Ponna Master Requirement, Spec v5 Refinement
// 1 / v6 Refinement 2, BINDING). Classifies VerifiedExamFactType into
// two behavioral groups for the "should this be re-verified via live
// search" check -- a fixed set-membership check, not a schema field,
// since Prisma enums can't carry metadata.

import { VerifiedExamFactType } from '@prisma/client';

const TIME_SENSITIVE_FACT_TYPES: Set<VerifiedExamFactType> = new Set([
  'APPLICATION_START_DATE',
  'APPLICATION_END_DATE',
  'EXAM_DATE',
  'VACANCY_COUNT',
  'HALL_TICKET_INFO',
  'ANSWER_KEY_STATUS',
  'RESULT_STATUS',
  'APPLICATION_CORRECTION_WINDOW',
] as VerifiedExamFactType[]);

const STALENESS_THRESHOLD_DAYS = 30;

/** Only time-sensitive fact types are ever considered "stale by age" --
 * stable facts (syllabus, pattern, eligibility, etc.) are never
 * auto-flagged just because verifiedAt is old, per the explicit
 * Master Requirement refinement that a static syllabus doesn't become
 * wrong just because 31 days passed. */
export function isFactStale(factType: VerifiedExamFactType, verifiedAt: Date): boolean {
  if (!TIME_SENSITIVE_FACT_TYPES.has(factType)) return false;
  const ageDays = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > STALENESS_THRESHOLD_DAYS;
}

export function isTimeSensitiveFactType(factType: VerifiedExamFactType): boolean {
  return TIME_SENSITIVE_FACT_TYPES.has(factType);
}
