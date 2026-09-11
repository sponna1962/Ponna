// Jest setup (Sept 2026, first test infrastructure for this codebase).
//
// This sandbox cannot regenerate a full Prisma client (no network access
// to download the query engine binary — documented in many commit
// messages this session). The client present in node_modules is a
// bare/stub client with NO enum runtime exports at all (SubscriptionStatus,
// Language, CorrectOption, etc. all resolve to `undefined`) — an
// environment-only limitation, not a real bug. Render/CI, with a properly
// generated client, would not have this problem.
//
// Most of the code under test only uses these enums as TypeScript TYPE
// annotations (erased at compile time, harmless even when undefined at
// runtime). This file patches ONLY the enum(s) that are genuinely
// dot-accessed at runtime by the services under test in this test phase
// (SubscriptionStatus.ACTIVE, in scope-access.service.ts and
// quota.service.ts) — with the real, unchanged string values Prisma
// generates for a string-backed enum (the enum's runtime shape is always
// `{ MEMBER: 'MEMBER' }`, identical to what a correctly generated client
// would produce). Extend this list if a later test phase covers a
// service that dot-accesses a different enum.
const clientModule = require('@prisma/client');

const ENUM_PATCHES: Record<string, Record<string, string>> = {
  SubscriptionStatus: { ACTIVE: 'ACTIVE', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' },
  Difficulty: { MEDIUM: 'MEDIUM', HARD: 'HARD' },
  QuestionCategory: { STANDARD: 'STANDARD', CURRENT_AFFAIRS: 'CURRENT_AFFAIRS' },
  SessionStatus: { IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', ABANDONED: 'ABANDONED' },
};

for (const [name, values] of Object.entries(ENUM_PATCHES)) {
  if (clientModule[name] === undefined) {
    clientModule[name] = values;
  }
}
