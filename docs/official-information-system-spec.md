# PONNA — Official Information System Master Specification v1.0

## 1. Product goal

Build one trusted information pipeline for the complete exam journey:

Official PDF → Processing → Admin Review → Verified Information → Tamil News → Student Inbox → Exam Timeline → Ask Ponna → Share

The system must extend the existing `VerifiedExamFact`, `CurrentAffairsItem`, notification-import and Ask Ponna infrastructure. Do not rebuild equivalent systems or delete existing data.

Core rule: **Verify → Answer → Clearly distinguish official / tentative / estimate → Never guess.**

## 2. Admin entry point

Add an admin-only section named **Official Documents**.

Document metadata:
- Exam Authority: TNPSC, TRB, TNUSRB, SSC, Railway, Banking, UPSC, etc.
- Exam / Sub-category
- Document Type
- PDF/file
- Official Source URL
- Document Date
- Optional short title
- Process Document

Document types:
- Notification
- Addendum / Corrigendum
- Application
- Exam Date
- Hall Ticket
- Answer Key
- Objection
- Result
- Certificate Verification
- Counselling
- Final Selection
- Other

## 3. Document lifecycle

Never auto-publish extracted facts or AI-generated news.

Required lifecycle:
1. Upload document
2. Extract text
3. Analyse and suggest structured facts
4. Admin review/edit/discard
5. Explicit approval
6. Approved facts enter verified knowledge
7. Tamil news draft may be generated
8. Editor reviews/edits news
9. News is published separately

Documents must be retained permanently. A later corrigendum/addendum must not delete the previous document. Previous versions become `Superseded` when applicable.

## 4. Verified facts

Use the existing `VerifiedExamFact` model/infrastructure where possible.

Every approved fact must retain:
- exam/sub-category
- fact type
- value
- official confirmation status
- source URL/document reference
- verified date
- document/version relationship

For changed facts, preserve history and identify the currently valid fact. Ask Ponna must prefer the latest valid verified fact.

## 5. Change detection

When a new document belongs to an existing exam journey:
- compare it with the latest relevant approved document/facts
- identify additions, removals and changed values
- show an admin-readable `What changed?` summary
- never silently overwrite historical information

Example:
Old exam date: 15 October
New official date: 22 October

Active fact = 22 October
Historical fact/document = retained and marked superseded

## 6. Tamil news generation

From an approved official document, generate a Tamil news draft containing, where relevant:
- clear headline
- short lead
- important facts
- what changed
- what students should do next
- official source attribution
- document date

AI draft is never automatically published.

Published news should have a public, readable PONNA URL. Sharing must point to this PONNA information/news page, not directly to a PDF.

## 7. Exam Timeline

Every exam may have a configurable timeline. Do not force irrelevant stages.

Possible stages:
1. Notification
2. Application Open
3. Application Close
4. Correction Window
5. Exam Date Announcement / Change
6. Hall Ticket
7. Examination
8. Answer Key
9. Objection
10. Result
11. Cut-off / Selection
12. Certificate Verification / Counselling / Next Stage
13. Final Selection / Appointment

Timeline entries should be linked to the relevant approved document, verified facts and published news where available.

## 8. Student Inbox

Do **not** add Notifications, News or Exam Updates as separate main-menu items.

Use the existing header inbox icon as **PONNA Inbox**.

Inbox sections:
- முக்கியமானவை / Important
- தேர்வு Updates / Exam Updates
- உங்கள் தயாரிப்பு / Your Preparation

Only useful, actionable information should be surfaced. Avoid notification fatigue.

Priority guidance:
- High: application closing, exam date change, hall ticket, answer key, result, important corrigendum
- Medium: new notification, syllabus information, important exam-related current affairs, new practice material
- Personal: daily goal, review mistakes, progress-related actions

Top area should show only the most relevant 2–3 items, with `View all` for the complete inbox.

## 9. Follow Exam

Students may follow an exam. Followed exams determine which official updates are relevant to that student's inbox.

Do not require students to follow every exam. Do not send every platform-wide update to every student.

## 10. Ask Ponna — New Announcements

Ask Ponna should contain a compact **புதிய அறிவிப்புகள் / New Announcements** section.

This is a preview, not a duplicate news feed.

Show the latest 2–3 relevant important announcements and a `அனைத்து அறிவிப்புகளையும் பார்க்க / View all` action.

Each item opens the same canonical PONNA information/news page used by the Inbox.

Ask Ponna can answer follow-up questions about the announcement, including:
- What changed?
- What should I do now?
- What is the current date/deadline?
- How does this affect my preparation?

The Ask Ponna source hierarchy and verification-tier rules remain binding.

## 11. Sharing

Every important official update/news page should have a small `↗ பகிர் / Share` action.

Supported destinations:
- WhatsApp
- Telegram
- Facebook
- Copy Link
- Native device share where supported

Share text should be concise and useful, containing:
- update headline
- short context
- PONNA public URL
- official source attribution

The shared page must be readable without login.

Do not expose private student data in share URLs or share text.

## 12. Save for Later

A lightweight save/bookmark action may be available on information/news pages. Saved items are private to the student and do not become notifications.

## 13. Single source of truth

Do not maintain separate copies of the same announcement for Inbox, Ask Ponna and Exam pages.

Canonical structure:
Official Document → Approved Facts / Published News → surfaces

Surfaces are:
- Inbox
- Ask Ponna New Announcements
- Exam Timeline
- Exam Updates page
- Share page

## 14. Accuracy and source display

For official verified information, display a compact source indicator such as:
`✓ அதிகாரப்பூர்வ தகவல் · Source: TNPSC · verified date`

For live-search information, use the existing Tier 3 distinction.

Never blend official verified facts, PONNA estimates and live web results into an indistinguishable answer.

The existing Ask Ponna rule remains: the AI disclaimer is not permission to guess.

## 15. Suggested data architecture

Prefer extending existing structures. New entities should be introduced only where required.

Likely concepts:
- OfficialExamDocument
- OfficialDocumentVersion / document history
- DocumentProcessing / extraction result
- DocumentFactCandidate
- ExamTimelineEntry
- ExamFollow
- StudentInboxItem
- NewsArticle / NewsDraft
- SavedInformation

Exact Prisma naming should follow the existing schema conventions after a code audit. Avoid duplicate models for functionality already represented by existing tables.

## 16. Notifications vs inbox

The system should not generate a notification for every content event.

An approved information item becomes an inbox item only when its relevance and priority rules say it is useful to that student.

The inbox is an action-oriented student surface, not a generic event log.

## 17. Non-goals

Do not add:
- a separate Notifications main menu
- a separate News main menu
- a separate Official Documents student menu
- automatic AI publication
- deletion of historical documents/facts
- duplicate information databases for Inbox and Ask Ponna
- unnecessary social-media UI

## 18. Acceptance criteria

A feature is complete only when:
- an official PDF can be uploaded with metadata
- text extraction/processing can produce reviewable candidates
- admin must explicitly approve facts
- approved facts are available to Ask Ponna with source metadata
- a news draft can be generated and requires editor approval before publishing
- an exam timeline reflects approved information
- relevant students can see the update in PONNA Inbox
- Ask Ponna shows the same update under New Announcements
- the same canonical public page can be shared
- old versions remain available and are marked superseded when changed
- a corrigendum updates the active fact without destroying history
- official / estimate / live-search information remains clearly distinguished
- no private student data is exposed through public share pages

## 19. Implementation order

Phase A — Audit existing implementation and identify reusable code.

Phase B — Official Document Core and processing/review workflow.

Phase C — Verified fact/versioning integration.

Phase D — News draft/editor/publishing.

Phase E — Exam Timeline.

Phase F — Student Inbox + Follow Exam.

Phase G — Ask Ponna New Announcements integration.

Phase H — Canonical public pages + Share + optional Save.

Phase I — End-to-end tests, permissions, source verification and regression testing.

Do not enable public/automatic flows before the corresponding approval and E2E tests are complete.
