# PONNA.in — Codebase (Starter Build)

This is a **real, runnable starting codebase** implementing the finalized Project Requirements Document (v1.1) — not a mockup. It covers the core, hardest-to-get-right business logic exactly as specified, plus a working frontend scaffold.

**Important — this code has not been run.** It was written and reasoned about carefully, including a self-review that caught and fixed one real bug (see "Two fixes made after a self-review" below), but it has not been executed with `npm install` / a live database / real API keys. Treat first-run TypeScript errors or small integration issues as expected, not a sign something is fundamentally wrong — this is normal for a codebase of this size that hasn't been compiled yet, and a developer's first hour should include getting it running locally and fixing whatever surfaces.

## What's implemented

**Backend** (`/backend`) — Node.js + Express + Prisma + PostgreSQL

*Milestone 1 — Foundation:*
- `prisma/schema.prisma` — the full database schema: users, staff roles, plans, subscriptions, exam taxonomy, questions (with Tamil/English + translation linking), quiz sessions, answer history, performance summaries, and an admin-configurable settings table
- `src/modules/quota/quota.service.ts` — Free (5/day) vs Plan 20/50 (600/1500 per 30-day pool, no daily sub-limit), manual renewal, no carry-forward, **no quota refund on abandoned sessions**
- `src/modules/questions/allocation.service.ts` — unseen-first allocation, configurable repetition policy, Current Affairs ratio + 90-day recency window, all read from `PlatformSettings` (nothing hardcoded)
- `src/modules/quiz/session.service.ts` — session start/resume/answer/complete, and the scheduled abandonment sweep
- `src/modules/ranking/ranking.service.ts` — accuracy-based ranking, 50-question eligibility threshold, three-level tie-break
- `prisma/seed.ts` — seeds the three plans, default settings, and a first Super Admin login (`admin@ponna.in` / `changeme123` — **change this before deploying**)

*Milestone 2 — Question bank & admin core:*
- `src/common/content-hash.ts` — normalized content hashing for duplicate detection (§6.3)
- `src/modules/questions/question.service.ts` — add/edit/publish/disable/set-difficulty, exact-duplicate blocking on single add, Current Affairs quick-entry (§7.1, §7.2)
- `src/modules/questions/bulk-upload.service.ts` — CSV parsing, per-row validation, duplicate detection (both against the DB and within the same file), auto-creates exam type/sub-type by name (§6.3, §7.1)
- `src/modules/admin/exam-taxonomy.service.ts` — Exam Type / Sub-Type CRUD (§7.1)
- `src/modules/admin/staff-auth.service.ts` — staff login (JWT) + role-gate middleware for `SUPER_ADMIN` / `CONTENT_ADMIN` / `VIEWER_STAFF` (§3, §7.8)
- `src/server.ts` — all routes wired: student routes (open) + admin routes (JWT-protected, role-gated)

*Milestone 3 — Quiz engine (student-facing UI wired to real sessions):*
- `session.service.ts` extended with `getSessionForStudent` (correct answers withheld until each question is actually answered — can't be read off the network payload in advance) and `getSessionResults` (score summary)
- Two new routes: `GET /quiz/:sessionId` and `GET /quiz/:sessionId/results`

*Milestone 6 — AI-assisted classification:*
- `src/modules/ai/classification.service.ts` — calls the Anthropic API per Draft question with exam-type-aware prompting, returns a suggested difficulty + confidence score; applies the confidence threshold (from `PlatformSettings`) to auto-publish high-confidence questions or leave low-confidence ones for review (§9)
- Bulk upload now automatically kicks off classification for the batch right after insert
- `GET /admin/questions/needs-review` — the review queue (lowest-confidence first)
- `GET /admin/ai/accuracy` — agreement-rate stats (how often admins keep vs. override the AI's suggestion), computed live from the data rather than a separate log

**Frontend** (`/frontend`) — Next.js + PWA

*Milestone 1:*
- `public/manifest.json` + `next.config.js` — installable PWA setup
- `src/lib/language-context.tsx` + `src/lib/translations.ts` + `src/components/LanguageToggle.tsx` — shared Tamil/English toggle (§4.5), persisted in localStorage, used on every student page
- `src/app/page.tsx`, `login`, `dashboard`, `quiz` — student-facing pages, all language-aware

*Milestone 2:*
- `src/app/admin/login/page.tsx` — staff login
- `src/app/admin/layout.tsx` — shared admin nav shell
- `src/app/admin/questions/page.tsx` — question list (filter by status), add-question form, publish/disable, difficulty override, AI-suggestion display
- `src/app/admin/questions/upload/page.tsx` — CSV bulk upload with a per-row result report (inserted / duplicate / invalid)
- `src/app/admin/exam-types/page.tsx` — manage Exam Types and Sub-Types

*Milestone 3:*
- `src/app/quiz/[sessionId]/page.tsx` — the actual quiz-taking screen: one question per screen (per the decision to keep it simple on mobile, no review screen), progress bar, difficulty/current-affairs badges, option selection with correct/incorrect feedback after each answer, then a results screen (accuracy %, answered, correct, links back to dashboard or to start another session)
- **Resume behavior is visible in the UI**: on load, the page finds the first unanswered question in the session and starts there — this is what makes the §4.3 disconnect/resume guarantee actually show up for the student, not just live in the backend

*Milestone 6:*
- `src/app/admin/questions/review/page.tsx` — the Needs Review queue: AI's suggestion + confidence shown per question, one tap on Medium/Hard accepts or overrides it and publishes immediately; an agreement-rate stats strip at the top
- A "Classify with AI" button added to the main questions list for on-demand single-question classification

*Settings & Current Affairs quick-entry:*
- `src/modules/admin/settings.service.ts` (backend) — single source of truth for every previously-hardcoded number (repetition strategy, Current Affairs caps per session size, recency window, AI confidence threshold, ranking eligibility minimum, session inactivity hours); `GET/PATCH /admin/settings`, PATCH restricted to `SUPER_ADMIN`
- `src/app/admin/settings/page.tsx` — the settings screen itself, grouped by the requirements doc section each control implements, read-only for non-Super-Admin roles
- `src/app/admin/current-affairs/page.tsx` — the fast daily-entry form from §7.2 (question + 4 options + correct answer + Publish, no exam taxonomy required)
- `src/lib/use-require-staff-auth.ts` + updated `admin/layout.tsx` — `/admin/*` pages now redirect to `/admin/login` client-side if no token is present, closing the route-protection gap noted earlier

*Student management, Plans, and scheduled jobs:*
- `src/modules/admin/student-management.service.ts` — student list with search, active plan, per-bucket performance, and a full detail view (subscriptions, performance, recent sessions); a platform-wide stats summary (§7.5)
- `src/modules/admin/plans.service.ts` — plan price/active-status management; quota structure itself stays fixed per the finalized requirements, only price and active flag are editable (§7.6, §13)
- `src/modules/scheduled-jobs.ts` — wires the previously-unscheduled abandonment sweep (every 15 min) and rank recomputation (hourly) to `node-cron`, started automatically on server boot
- `src/app/admin/students/page.tsx` — student list + platform stats, searchable, linking to…
- `src/app/admin/students/[id]/page.tsx` — individual student detail: performance by bucket, subscription/cycle history, recent quiz sessions — enough to answer "why does my quota look wrong?" support questions
- `src/app/admin/plans/page.tsx` — plan price/status management, Super-Admin-gated
- `src/app/admin/staff/page.tsx` — staff account list, create-new-staff form (role picker: Super Admin / Content Admin / Viewer-Staff), deactivate button — completes §7.8, Super-Admin-only both in the UI and on the backend

*Two fixes made after a self-review:*
- **Session-size shortfall bug**: `session.service.ts`'s `startSession` used to reserve the full requested quota (e.g. 20 questions) *before* checking whether the question bank actually had 20 eligible questions to give — meaning a student could be charged for questions they never received if the bank was thin (e.g. a new exam type with few questions uploaded so far). Fixed: the eligible question list is now built first, and quota is reserved only for the actual number of questions the session will contain. The frontend surfaces a shortfall notice if fewer questions were available than requested.
- **Payment integration, both sides**: `src/modules/payments/payment.service.ts` — Razorpay order creation (`POST /payments/create-order`) and a signature-verified webhook handler (`POST /webhooks/razorpay`) that is the *only* place a `Subscription` gets created, specifically so a spoofed client-side "payment succeeded" call can't grant free access. Idempotent on Razorpay's payment id (webhooks can be delivered more than once by design). Manual renewal only, no cycle carry-forward — consistent with §5. `src/app/plans/page.tsx` is the student-facing purchase page that calls order-creation and opens Razorpay's checkout widget; the dashboard's "Upgrade" prompt now links here.

## What is NOT yet built (and why)

This is a starting foundation, not the finished platform. Missing pieces fall into two categories:

**1. Needs your decisions/accounts before it can be built:**
- Real student authentication (OTP via an SMS provider — needs a provider account, e.g. MSG91/Twilio)
- **Payment integration code is now built** (order creation + webhook), but it needs your actual Razorpay business account credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` in `.env`) and finalized plan prices set from the admin Plans screen before it can process a real payment
- Hosting/deployment (needs a server/Vercel/Railway account and your domain DNS pointed to it, including a public HTTPS URL for Razorpay to reach `/webhooks/razorpay`)
- AI classification needs an `ANTHROPIC_API_KEY` — get one at console.anthropic.com; without it, uploaded questions simply stay in Draft with no AI suggestion, and everything still works manually via the admin panel's difficulty dropdown

**2. Straightforward to build on this foundation, just not done yet:**
- Localizing the raw error messages the backend returns (e.g. quota-exceeded text) — currently always English regardless of the student's selected language
- Batch classification currently runs in-process (fire-and-forget after upload) with a fixed pacing delay — fine for the question volumes described in the requirements doc, but should move to a real job queue (e.g. BullMQ) before very large bulk uploads
- Editing/disabling individual questions from the admin question list only supports difficulty and status changes right now — full field editing (question text, options) exists on the backend (`question.service.ts`'s `update`) but has no edit-in-place UI yet, only the add-new form

## Running this locally

```bash
# Backend
cd backend
npm install
# set DATABASE_URL in a .env file, pointing at a local/hosted Postgres instance
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run dev        # API on :4000

# Frontend
cd frontend
npm install
npm run dev         # site on :3000
```

## Suggested next step

The core product loop and its monetization path are now built end to end in code: student practices → hits their quota → buys a plan (real Razorpay order + webhook-verified activation) → keeps practicing with the new quota. The admin panel covers every section of §7. What remains is exactly three things only you can provide: an SMS/OTP provider account for real student login, your actual Razorpay business credentials, and hosting for your domain (Razorpay's webhook needs a public HTTPS URL to reach). Beyond that, I'd treat this as ready to hand to a developer for the polish pass noted above (tests, error states, rate limiting) before a real launch — I've been thorough about flagging what's a solid foundation versus what still needs review, and that line is worth taking seriously before this goes live with real students and real money.
