// Minimal API server wiring the core student-facing endpoints to the services
// built in modules/. This is a working skeleton — student auth here is a
// placeholder (userId taken directly from the request body) and must be
// replaced with real OTP-based auth + JWT middleware before production.
// Staff/admin routes DO use real JWT + role-gate middleware (see staff-auth.service.ts).

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { SessionService } from './modules/quiz/session.service';
import { RankingService } from './modules/ranking/ranking.service';
import { QuotaExceededError } from './modules/quota/quota.service';
import { QuestionService } from './modules/questions/question.service';
import { BulkUploadService } from './modules/questions/bulk-upload.service';
import { TranslationService } from './modules/questions/translation.service';
import { ExamTaxonomyService } from './modules/admin/exam-taxonomy.service';
import { StaffAuthService, requireStaffAuth, requireRole, AuthedRequest } from './modules/admin/staff-auth.service';
import { ClassificationService } from './modules/ai/classification.service';
import { SettingsService } from './modules/admin/settings.service';
import { StudentManagementService } from './modules/admin/student-management.service';
import { PlansService } from './modules/admin/plans.service';
import { startScheduledJobs } from './modules/scheduled-jobs';
import { PaymentService, ProfileIncompleteError } from './modules/payments/payment.service';
import { StudentAuthService, requireStudentAuth, StudentAuthedRequest } from './modules/auth/student-auth.service';
import { ProfileService } from './modules/profile/profile.service';

const app = express();
// CORS: in production the frontend (Vercel) and backend (Railway) are on
// different domains, so this can't be left wide-open without a config knob.
// Set FRONTEND_URL in the backend's environment to your Vercel URL once
// deployed; falls back to allowing all origins for local development.
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
// Captures the raw request body alongside the parsed JSON — needed for
// verifying the Razorpay webhook signature, which is computed over the raw
// bytes, not the re-serialized JSON (those can differ in whitespace/key order).
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
const upload = multer({ storage: multer.memoryStorage() });

const sessionService = new SessionService();
const rankingService = new RankingService();
const questionService = new QuestionService();
const bulkUploadService = new BulkUploadService();
const translationService = new TranslationService();
const examTaxonomyService = new ExamTaxonomyService();
const staffAuthService = new StaffAuthService();
const classificationService = new ClassificationService();
const settingsService = new SettingsService();
const studentManagementService = new StudentManagementService();
const plansService = new PlansService();
const paymentService = new PaymentService();
const studentAuthService = new StudentAuthService();
const profileService = new ProfileService();

// ─────────────────────────────────────────────────────────
// STUDENT AUTH  (§4.1) — Firebase Phone Auth verification
// ─────────────────────────────────────────────────────────

// POST /auth/firebase-login  { firebaseIdToken }
// Called by the frontend after Firebase's client SDK confirms the OTP.
app.post('/auth/firebase-login', async (req, res) => {
  try {
    const { firebaseIdToken } = req.body;
    const result = await studentAuthService.loginWithFirebaseToken(firebaseIdToken);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(401).json({ error: err.message ?? 'Login failed' });
  }
});

// ─────────────────────────────────────────────────────────
// STUDENT ROUTES
// ─────────────────────────────────────────────────────────

// POST /quiz/start  { mode: 'MIXED'|'MEDIUM'|'HARD', sessionSize }  — userId now comes from the JWT, not the request body
app.post('/quiz/start', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { mode, sessionSize } = req.body;
    const session = await sessionService.startSession(req.studentUserId!, mode, sessionSize);
    res.json(session);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return res.status(403).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// GET /quiz/:sessionId  — session + questions for the quiz-taking UI
app.get('/quiz/:sessionId', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const session = await sessionService.getSessionForStudent(req.params.sessionId);
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Session not found' });
  }
});

// POST /quiz/:sessionId/answer  { questionId, selectedOption }
app.post('/quiz/:sessionId/answer', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { questionId, selectedOption } = req.body;
    const result = await sessionService.submitAnswer(req.params.sessionId, questionId, selectedOption);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// POST /quiz/:sessionId/complete
app.post('/quiz/:sessionId/complete', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const session = await sessionService.completeSession(req.params.sessionId);
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete session' });
  }
});

// GET /quiz/:sessionId/results — score summary for the results screen
app.get('/quiz/:sessionId/results', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const results = await sessionService.getSessionResults(req.params.sessionId);
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Session not found' });
  }
});

// GET /students/me/dashboard — userId comes from the JWT
app.get('/students/me/dashboard', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const dashboard = await rankingService.getStudentDashboard(req.studentUserId!);
    res.json(dashboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /students/me/profile
app.get('/students/me/profile', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const profile = await profileService.getProfile(req.studentUserId!);
    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PATCH /students/me/profile  { name?, district?, cityTownVillage?, preparingFor? }
app.patch('/students/me/profile', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const result = await profileService.updateProfile(req.studentUserId!, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─────────────────────────────────────────────────────────
// PAYMENTS  (§5, §7.6) — Razorpay
// ─────────────────────────────────────────────────────────

// POST /payments/create-order  { planCode: 'PLAN_20'|'PLAN_50' } — userId comes from the JWT
app.post('/payments/create-order', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { planCode } = req.body;
    const order = await paymentService.createOrder(req.studentUserId!, planCode);
    res.json(order);
  } catch (err: any) {
    console.error(err);
    if (err instanceof ProfileIncompleteError) {
      // Distinct error code so the frontend can redirect to /profile rather
      // than just showing a generic payment-failed message.
      return res.status(400).json({ error: err.message, code: 'PROFILE_INCOMPLETE' });
    }
    res.status(400).json({ error: err.message ?? 'Failed to create payment order' });
  }
});

// POST /webhooks/razorpay — called BY Razorpay, not by the frontend.
// This is the only place a Subscription is actually created; never trust a
// client-side "payment succeeded" callback for that (it can be spoofed).
app.post('/webhooks/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const rawBody = (req as any).rawBody as Buffer;

    if (!signature || !rawBody || !paymentService.verifyWebhookSignature(rawBody.toString(), signature)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    if (req.body.event === 'payment.captured') {
      const result = await paymentService.handlePaymentCaptured(req.body);
      return res.json(result);
    }

    // Other event types (payment.failed, refund.processed, etc.) are
    // acknowledged but not acted on yet — extend here as needed.
    res.json({ status: 'ignored', event: req.body.event });
  } catch (err: any) {
    console.error('Webhook processing failed:', err);
    // Still return 200-range error carefully: Razorpay retries on failure,
    // which is desirable for transient errors, so a 500 here is intentional.
    res.status(500).json({ error: err.message ?? 'Webhook processing failed' });
  }
});

// ─────────────────────────────────────────────────────────
// STAFF AUTH  (§7.8)
// ─────────────────────────────────────────────────────────

// POST /admin/auth/login  { email, password }
app.post('/admin/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await staffAuthService.login(email, password);
    res.json(result);
  } catch {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// POST /admin/staff  { email, password, role }  — Super Admin only
app.post(
  '/admin/staff',
  requireStaffAuth,
  requireRole('SUPER_ADMIN'),
  async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const staff = await staffAuthService.createStaff(email, password, role, (req as AuthedRequest).staff!.staffId);
      res.json(staff);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create staff account' });
    }
  },
);

// GET /admin/staff  — Super Admin only
app.get('/admin/staff', requireStaffAuth, requireRole('SUPER_ADMIN'), async (_req, res) => {
  res.json(await staffAuthService.listStaff());
});

// POST /admin/staff/:id/deactivate — Super Admin only
app.post('/admin/staff/:id/deactivate', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await staffAuthService.deactivateStaff(req.params.id));
});

// ─────────────────────────────────────────────────────────
// QUESTION MANAGEMENT  (§7.1) — Super Admin + Content Admin
// ─────────────────────────────────────────────────────────

const canEditQuestions = requireRole('SUPER_ADMIN', 'CONTENT_ADMIN');

// GET /admin/questions?status=DRAFT&difficulty=MEDIUM&page=1&search=piaget
app.get('/admin/questions', requireStaffAuth, async (req, res) => {
  try {
    const { status, difficulty, examTypeId, category, language, search, page, pageSize } = req.query;
    const result = await questionService.list({
      status: status as any,
      difficulty: difficulty as any,
      examTypeId: examTypeId as string,
      category: category as any,
      language: language as any,
      search: search as string,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list questions' });
  }
});

// POST /admin/questions  — add a single question
app.post('/admin/questions', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const question = await questionService.create(req.body);
    res.json(question);
  } catch (err: any) {
    res.status(409).json({ error: err.message });
  }
});

// PATCH /admin/questions/:id
app.patch('/admin/questions/:id', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const question = await questionService.update(req.params.id, req.body);
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update question' });
  }
});

// POST /admin/questions/:id/publish | /disable | /draft
app.post('/admin/questions/:id/:action(publish|disable|draft)', requireStaffAuth, canEditQuestions, async (req, res) => {
  const statusMap = { publish: 'PUBLISHED', disable: 'DISABLED', draft: 'DRAFT' } as const;
  const question = await questionService.setStatus(req.params.id, statusMap[req.params.action as 'publish' | 'disable' | 'draft']);
  res.json(question);
});

// POST /admin/questions/:id/difficulty  { difficulty }
app.post('/admin/questions/:id/difficulty', requireStaffAuth, canEditQuestions, async (req, res) => {
  const question = await questionService.setDifficulty(req.params.id, req.body.difficulty);
  res.json(question);
});

// POST /admin/questions/current-affairs — quick-entry (§7.2)
app.post('/admin/questions/current-affairs', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const question = await questionService.createCurrentAffairs(req.body);
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add current affairs question' });
  }
});

// POST /admin/questions/translate-preview  { fields: {questionText, optionA..D}, fromLang }
// Used by the admin form's live "type in one language, other auto-fills" flow.
// Does NOT save anything — just returns the translation for the admin to review.
app.post('/admin/questions/translate-preview', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const { fields, fromLang } = req.body;
    const translated = await translationService.previewTranslation(fields, fromLang);
    res.json(translated);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Translation failed' });
  }
});

// POST /admin/questions/bilingual  { ta: {...}, en: {...} }
// Creates both language versions at once, linked by translationGroupId —
// used when the admin has reviewed both languages in the form and clicks Publish/Save.
app.post('/admin/questions/bilingual', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const { ta, en } = req.body;
    const result = await questionService.createBilingualPair(ta, en);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(409).json({ error: err.message ?? 'Failed to create question pair' });
  }
});

// ── Bulk actions (select multiple in the admin list, act once) ──────────

// POST /admin/questions/bulk-publish  { ids: string[] }
app.post('/admin/questions/bulk-publish', requireStaffAuth, canEditQuestions, async (req, res) => {
  const result = await questionService.bulkSetStatus(req.body.ids, 'PUBLISHED');
  res.json(result);
});

// POST /admin/questions/bulk-disable  { ids: string[] }
app.post('/admin/questions/bulk-disable', requireStaffAuth, canEditQuestions, async (req, res) => {
  const result = await questionService.bulkSetStatus(req.body.ids, 'DISABLED');
  res.json(result);
});

// POST /admin/questions/bulk-delete  { ids: string[] } — Super Admin only, this is destructive
app.post('/admin/questions/bulk-delete', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const result = await questionService.bulkDelete(req.body.ids);
  res.json(result);
});

// POST /admin/questions/bulk-classify  { ids: string[] }
app.post('/admin/questions/bulk-classify', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const result = await classificationService.classifyQuestionIds(req.body.ids);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Bulk classification failed' });
  }
});

// POST /admin/questions/bulk-upload  (multipart form, field name "file")
app.post(
  '/admin/questions/bulk-upload',
  requireStaffAuth,
  canEditQuestions,
  upload.single('file'),
  async (req: AuthedRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const csvContent = req.file.buffer.toString('utf-8');
      const { batchId, results } = await bulkUploadService.processCsv(csvContent, req.staff!.staffId);

      // Kick off AI classification for this batch in the background — the
      // upload response returns immediately with the row report; classification
      // results show up in the Needs Review queue / auto-publish shortly after.
      // (Fire-and-forget here; for large batches in production, hand this to a
      // proper job queue instead of an in-process async call.)
      classificationService.classifyPendingQuestions(batchId).catch((err) =>
        console.error(`Background classification failed for batch ${batchId}:`, err),
      );

      res.json({ batchId, summary: bulkUploadService.summarize(results), results });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Bulk upload failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────
// AI CLASSIFICATION  (§9) — Super Admin + Content Admin
// ─────────────────────────────────────────────────────────

// POST /admin/questions/classify-batch  { batchId? } — classify all pending drafts (optionally scoped to a batch)
app.post('/admin/questions/classify-batch', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const result = await classificationService.classifyPendingQuestions(req.body?.batchId);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Classification failed' });
  }
});

// POST /admin/questions/:id/classify — (re-)classify a single question on demand
app.post('/admin/questions/:id/classify', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const result = await classificationService.classifyAndApply(req.params.id);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Classification failed' });
  }
});

// GET /admin/questions/needs-review — Content Admin review queue (§7.3)
app.get('/admin/questions/needs-review', requireStaffAuth, async (_req, res) => {
  try {
    const queue = await classificationService.getNeedsReviewQueue();
    res.json(queue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load review queue' });
  }
});

// GET /admin/ai/accuracy — accuracy dashboard (§7.3)
app.get('/admin/ai/accuracy', requireStaffAuth, async (_req, res) => {
  try {
    res.json(await classificationService.getAccuracyStats());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load accuracy stats' });
  }
});

// ─────────────────────────────────────────────────────────
// EXAM TAXONOMY  (§7.1)
// ─────────────────────────────────────────────────────────

app.get('/admin/exam-types', requireStaffAuth, async (_req, res) => {
  res.json(await examTaxonomyService.listExamTypes());
});

app.post('/admin/exam-types', requireStaffAuth, canEditQuestions, async (req, res) => {
  res.json(await examTaxonomyService.createExamType(req.body.name));
});

app.post('/admin/exam-types/:examTypeId/sub-types', requireStaffAuth, canEditQuestions, async (req, res) => {
  res.json(await examTaxonomyService.createExamSubType(req.params.examTypeId, req.body.name));
});

// ─────────────────────────────────────────────────────────
// PLATFORM SETTINGS  (§7.7) — Super Admin only (these control platform-wide
// business rules: repetition policy, Current Affairs ratios/recency, AI
// threshold, ranking eligibility — nothing here should be editable by Content
// Admin or Viewer roles)
// ─────────────────────────────────────────────────────────

app.get('/admin/settings', requireStaffAuth, async (_req, res) => {
  res.json(await settingsService.get());
});

app.patch('/admin/settings', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    res.json(await settingsService.update(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ─────────────────────────────────────────────────────────
// STUDENT & PERFORMANCE MANAGEMENT  (§7.5) — all staff roles can view
// ─────────────────────────────────────────────────────────

app.get('/admin/students', requireStaffAuth, async (req, res) => {
  try {
    const { search, page, pageSize } = req.query;
    const result = await studentManagementService.listStudents({
      search: search as string,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list students' });
  }
});

app.get('/admin/students/:id', requireStaffAuth, async (req, res) => {
  try {
    res.json(await studentManagementService.getStudentDetail(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Student not found' });
  }
});

app.get('/admin/platform-stats', requireStaffAuth, async (_req, res) => {
  res.json(await studentManagementService.getPlatformStats());
});

// ─────────────────────────────────────────────────────────
// PLANS & SUBSCRIPTIONS  (§7.6) — Super Admin edits, others view
// ─────────────────────────────────────────────────────────

app.get('/admin/plans', requireStaffAuth, async (_req, res) => {
  res.json(await plansService.listPlans());
});

app.patch('/admin/plans/:id/price', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    res.json(await plansService.updatePlanPrice(req.params.id, req.body.price));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update plan price' });
  }
});

app.post('/admin/plans/:id/:action(activate|deactivate)', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  const active = req.params.action === 'activate';
  res.json(await plansService.setPlanActive(req.params.id, active));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PONNA API listening on :${PORT}`);
  startScheduledJobs();
});
