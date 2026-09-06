# PONNA — Official Information System Phase A Audit

Date: 2026-09-06
Base audited: `bc024c2e0cc267d32c9c131214487b97c249d8c0`

## 1. Existing infrastructure confirmed

### Verified exam facts
`VerifiedExamFact` already exists and is the canonical structured exam-information layer used by Ask Ponna. It is scoped to `ExamSubCategory`, stores `factType`, `value`, official-confirmation state, `sourceUrl`, and `verifiedAt`.

**Decision:** extend this layer rather than create a second verified-facts database.

### Notification import
`NotificationImport` already exists and is connected to the notification-import workflow. The existing implementation accepts notification text and creates reviewable candidate `VerifiedExamFact` rows; explicit admin approval is required before a real verified fact is created.

**Decision:** retain this approval discipline and extend the input side to support official PDF processing.

### Current affairs
`CurrentAffairsItem` already exists and is exposed through the Ask Ponna tool layer. It stores date, headline, summary, source URL, exam-relevance note and verification date.

**Decision:** do not repurpose this table as the official-document store. It may be used as a downstream current-affairs/news source where appropriate.

### Ask Ponna
The Ask Ponna tool layer already reads `VerifiedExamFact`, and the orchestrator enforces the binding rule:
`VERIFY → ANSWER → CLEARLY DISTINGUISH OFFICIAL / TENTATIVE / ESTIMATE → NEVER GUESS.`

**Decision:** Official Information should feed Ask Ponna through the existing verified-fact layer plus a dedicated announcement/news surface, not through a parallel AI knowledge store.

### Existing share infrastructure
`ShareToken` and an existing progress-sharing service are present.

**Decision:** do not reuse progress-sharing URLs for official information. Build a separate canonical public information URL/share target so private student data can never leak into an official update share.

## 2. Required new capabilities

The audit identifies these capabilities as genuinely missing or requiring extension:

1. Official document record with authority, exam, type, source URL and document date.
2. Uploaded PDF/file reference and processing status.
3. Document version/history and superseded relationship.
4. Extracted text / processing result.
5. Reviewable fact candidates tied to the source document.
6. Change detection against the latest approved document/facts.
7. News draft/editor workflow tied to an approved source document.
8. Exam timeline entries tied to approved information.
9. Student relevance/follow-exam relation.
10. Student Inbox items derived from approved information.
11. Ask Ponna New Announcements preview using the same canonical information records.
12. Public canonical information/news page.
13. Official-information share action and share metadata.
14. Optional private Save-for-Later relation.

## 3. Non-duplication rules

- Do not create another verified-fact table.
- Do not create a second current-affairs table.
- Do not create a second notification system for Ask Ponna.
- Do not use `ShareToken` for official-information URLs.
- Inbox and Ask Ponna must consume the same canonical announcement/update records.
- Historical official documents/facts must never be physically deleted when superseded.

## 4. Implementation order after audit

### Phase B — Official Document Core
Add the minimum document/version/processing/candidate structures and admin workflow. PDF processing must stop at reviewable draft/candidate state; no automatic publication.

### Phase C — Verified Fact Integration
Approved candidates create/update the existing `VerifiedExamFact` records while retaining document/version provenance and history.

### Phase D — News
Generate a Tamil news draft from approved facts/document text. Require editor approval before publication.

### Phase E — Timeline
Create configurable exam journey entries and attach approved documents/facts/news.

### Phase F — Inbox + Follow Exam
Surface only relevant/actionable updates. Do not create a generic notification feed.

### Phase G — Ask Ponna New Announcements
Show a compact 2–3 item preview on the Ask Ponna landing page. Items must resolve to the same canonical public information page used by Inbox and Exam Updates.

### Phase H — Public page + Share
Create a public, login-free canonical page with source attribution and a small Share action. Never include private student data.

### Phase I — E2E and regression
Test PDF → approval → fact → news → timeline → inbox → Ask Ponna → public share, plus corrigendum/version history and permission boundaries.

## 5. Guardrails

- No automatic publication.
- No guessing or silent reconciliation of official information.
- Official, tentative/estimate and live-search information must remain distinguishable.
- New documents must not overwrite historical documents.
- Student-facing launch navigation remains minimal; no separate Notifications/News/Official Documents main-menu items.
- Existing working features must not be refactored merely for stylistic consistency.
