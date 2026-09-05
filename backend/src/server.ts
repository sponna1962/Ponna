// Minimal API server wiring the core student-facing endpoints to the services
// built in modules/. This is a working skeleton — student auth here is a
// placeholder (userId taken directly from the request body) and must be
// replaced with real OTP-based auth + JWT middleware before production.
// Staff/admin routes DO use real JWT + role-gate middleware (see staff-auth.service.ts).

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { SessionService } from './modules/quiz/session.service';
import { PracticePreferenceService, InvalidSelectionError } from './modules/practice-preference/practice-preference.service';
import { RankingService } from './modules/ranking/ranking.service';
import { QuotaExceededError, QuotaService } from './modules/quota/quota.service';
import { QuestionService, NoDifficultySetError } from './modules/questions/question.service';
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
import { StudentAuthService, requireStudentAuth, StudentAuthedRequest, AccountLinkingConflictError, DeviceLimitReachedError } from './modules/auth/student-auth.service';
import { ProfilePhotoService } from './modules/profile/profile-photo.service';
import { QuestionReportService } from './modules/questions/question-report.service';
import { StudentReviewService } from './modules/questions/student-review.service';
import { MistakeReviewService } from './modules/questions/mistake-review.service';
import { AskPonnaService, AskPonnaAccessError, AskPonnaLimitError } from './modules/ask-ponna/ask-ponna.service';
import { getNudge as getAskPonnaNudge } from './modules/ask-ponna/nudge';
import { getStreakDisplay } from './modules/practice-preference/streak.service';
import { ShareProgressService } from './modules/practice-preference/share-progress.service';
import { ReferralService } from './modules/practice-preference/referral.service';
import { MilestoneService } from './modules/practice-preference/milestone.service';
import { getTimeAnalytics } from './modules/practice-preference/time-analytics.service';
import { SubjectPreferenceService } from './modules/practice-preference/subject-preference.service';
import { DailyQuizService, DailyQuizError } from './modules/daily-quiz/daily-quiz.service';
import { SyllabusService } from './modules/admin/syllabus.service';
import { ExamFactsService } from './modules/admin/exam-facts.service';
import { CutoffService } from './modules/admin/cutoff.service';
import { CurrentAffairsService } from './modules/admin/current-affairs.service';
import { PonnaFaqService } from './modules/admin/ponna-faq.service';
import { NotificationImportService } from './modules/admin/notification-import.service';
import { CutoffPredictorService } from './modules/practice-preference/cutoff-predictor.service';
import { MockExamAdminService } from './modules/admin/mock-exam-admin.service';
import { MockExamService } from './modules/quiz/mock-exam.service';
import { DiagnosticService } from './modules/quiz/diagnostic.service';
import { DailyQuizType } from '@prisma/client';
import { ProfileService } from './modules/profile/profile.service';

const app = express();
// Render sits behind a reverse proxy — without this, req.ip would always
// be the proxy's own internal address (the same for every request),
// making the suspicious-usage sweep's signup-IP-clustering signal useless
// (finalized requirement). `true` trusts the immediate proxy's
// X-Forwarded-For header, which is what Render's edge sets.
app.set('trust proxy', true);
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
    // Default (100kb) is far too small for a bulk question-upload Confirm
    // Import payload — a batch of a few hundred rows, each with Tamil +
    // English question text and 4 options per language, easily exceeds it.
    // When that happened, Express rejected the request before it ever
    // reached the route handler, so the route's own try/catch never ran —
    // the frontend saw a non-JSON error response and silently did nothing.
    limit: '15mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
const upload = multer({ storage: multer.memoryStorage() });

const sessionService = new SessionService();
const practicePreferenceService = new PracticePreferenceService();
const quota = new QuotaService();
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
const profilePhotoService = new ProfilePhotoService();
const questionReportService = new QuestionReportService();
const studentReviewService = new StudentReviewService();
const mistakeReviewService = new MistakeReviewService();
const askPonnaService = new AskPonnaService();
const subjectPreferenceService = new SubjectPreferenceService();
const dailyQuizService = new DailyQuizService();
const syllabusService = new SyllabusService();
const examFactsService = new ExamFactsService();
const cutoffService = new CutoffService();
const currentAffairsService = new CurrentAffairsService();
const ponnaFaqService = new PonnaFaqService();
const notificationImportService = new NotificationImportService();
const cutoffPredictorService = new CutoffPredictorService();
const mockExamAdminService = new MockExamAdminService();
const mockExamService = new MockExamService();
const diagnosticService = new DiagnosticService();
const shareProgressService = new ShareProgressService();
const referralService = new ReferralService();
const milestoneService = new MilestoneService();
const profileService = new ProfileService();

// ─────────────────────────────────────────────────────────
// STUDENT AUTH  (§4.1) — Firebase Phone Auth verification
// ─────────────────────────────────────────────────────────

// POST /auth/firebase-login  { firebaseIdToken }
// Called by the frontend after Firebase's client SDK confirms the OTP
// (Phone) or completes the Google popup sign-in — both arrive here the
// same way; see student-auth.service.ts for how each is resolved.
app.post('/auth/firebase-login', async (req, res) => {
  try {
    const { firebaseIdToken, deviceId, deviceLabel, referralCode } = req.body;
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId is required' });
      return;
    }
    const result = await studentAuthService.loginWithFirebaseToken(firebaseIdToken, deviceId, deviceLabel, req.ip, referralCode);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    if (err instanceof AccountLinkingConflictError) {
      // A distinct, structured code — not just a generic 401 — so the
      // frontend can show the specific "log in with Phone, then link
      // Google from Profile" guidance instead of a plain error message.
      res.status(409).json({ error: err.message, code: 'ACCOUNT_LINKING_CONFLICT' });
      return;
    }
    if (err instanceof DeviceLimitReachedError) {
      // Also a structured code — carries the existing devices so the
      // frontend can offer "remove one to continue" without a session
      // token (the student isn't logged in yet at this point).
      res.status(403).json({ error: err.message, code: 'DEVICE_LIMIT_REACHED', devices: err.devices });
      return;
    }
    res.status(401).json({ error: 'Login failed. Please try again, or contact support if this continues.' });
  }
});

// POST /auth/remove-device  { firebaseIdToken, deviceId } — re-verifies the
// SAME Firebase ID token the student just tried to log in with (proving
// it's really them) and removes one registered device, freeing a slot so
// they can retry POST /auth/firebase-login with the same deviceId as
// before. No student session token required/used here — there isn't one
// yet when this is called from the device-limit-reached screen.
app.post('/auth/remove-device', async (req, res) => {
  try {
    const { firebaseIdToken, deviceId } = req.body;
    await studentAuthService.removeDeviceViaFirebaseToken(firebaseIdToken, deviceId);
    res.json({ removed: true });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to remove device' });
  }
});

// GET /students/me/wrong-questions — Wrong Questions Review (finalized
// requirement). Pure review — reuses history that already exists, never
// creates a new re-answerable session or touches the allocation engine.
app.get('/students/me/wrong-questions', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await studentReviewService.listWrongQuestions(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load wrong questions' });
  }
});

// ── Review Mistakes (finalized requirement) — separate revision flow ──────
// GET /students/me/mistakes?filter=all|subject|recent
app.get('/students/me/mistakes', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const filter = (req.query.filter as 'all' | 'subject' | 'recent') ?? 'all';
    res.json(await mistakeReviewService.listMistakes(req.studentUserId!, filter));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Review Mistakes' });
  }
});

// POST /students/me/mistakes/:questionId/review  { selectedOption }
app.post('/students/me/mistakes/:questionId/review', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const result = await mistakeReviewService.reviewAnswer(req.studentUserId!, req.params.questionId, req.body.selectedOption);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to submit review answer' });
  }
});

// ── Ask Ponna — Personal AI Study & Exam Assistant (finalized requirement,
// Specification v3, Phase 1) ────────────────────────────────────────────

app.get('/ask-ponna/enabled', async (_req, res) => {
  try {
    const settings = await settingsService.get();
    res.json({ enabled: settings.askPonnaEnabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check Ask Ponna availability' });
  }
});

// GET /ask-ponna/nudge — proactive, rule-based (no AI call) Dashboard
// insight card (finalized requirement). Returns null when nothing
// meaningful applies -- the frontend simply shows no card in that case.
app.get('/ask-ponna/nudge', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const settings = await settingsService.get();
    if (!settings.askPonnaEnabled) return res.json(null);
    res.json(await getAskPonnaNudge(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load nudge' });
  }
});

// GET /students/me/streak — Daily Streak (finalized requirement).
app.get('/students/me/streak', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await getStreakDisplay(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load streak' });
  }
});

// ── Parent/Mentor Progress Sharing (finalized requirement) ─────────────

app.get('/students/me/share-progress', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await shareProgressService.getStatus(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load share status' });
  }
});

app.post('/students/me/share-progress', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await shareProgressService.createOrGetToken(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

app.delete('/students/me/share-progress', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    await shareProgressService.revoke(req.studentUserId!);
    res.json({ revoked: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

// GET /shared/:token — PUBLIC, no auth. Safe summary only, never PII.
app.get('/shared/:token', async (req, res) => {
  try {
    const summary = await shareProgressService.getPublicSummary(req.params.token);
    if (!summary) return res.status(404).json({ error: 'This share link is invalid or has been revoked.' });
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load shared progress' });
  }
});

// ── Referral Program (finalized requirement — structure only, reward
// trigger pending Razorpay integration) ────────────────────────────────

app.get('/students/me/referral', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const code = await referralService.getOrCreateCode(req.studentUserId!);
    const stats = await referralService.getMyReferrals(req.studentUserId!);
    res.json({ code, ...stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load referral info' });
  }
});

// GET /students/me/milestones — Milestone Badges (finalized requirement).
app.get('/students/me/milestones', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await milestoneService.listMine(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load milestones' });
  }
});

// GET /students/me/time-analytics — Time-Management Analytics (finalized requirement).
app.get('/students/me/time-analytics', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await getTimeAnalytics(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load time analytics' });
  }
});


app.get('/ask-ponna/conversations', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await askPonnaService.listConversations(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

app.get('/ask-ponna/conversations/:id', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await askPonnaService.getConversation(req.studentUserId!, req.params.id));
  } catch (err: any) {
    console.error(err);
    res.status(404).json({ error: err.message ?? 'Conversation not found' });
  }
});

app.delete('/ask-ponna/conversations/:id', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    await askPonnaService.deleteConversation(req.studentUserId!, req.params.id);
    res.json({ deleted: true });
  } catch (err: any) {
    console.error(err);
    res.status(404).json({ error: err.message ?? 'Conversation not found' });
  }
});

// POST /ask-ponna/chat  { conversationId?: string, message: string }
app.post('/ask-ponna/chat', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const result = await askPonnaService.sendMessage(req.studentUserId!, req.body.conversationId ?? null, req.body.message);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    if (err instanceof AskPonnaAccessError) return res.status(403).json({ error: err.message });
    if (err instanceof AskPonnaLimitError) return res.status(429).json({ error: err.message });
    res.status(500).json({ error: 'Ask Ponna could not respond right now. Please try again.' });
  }
});

// ── Student Subject & Topic Preference — Stage 1 (finalized requirement) ──
// Storage + picker only, not yet connected to question allocation.

app.get('/subject-preference/exams', requireStudentAuth, async (_req, res) => {
  try {
    res.json(await subjectPreferenceService.listAvailableExams());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list exams' });
  }
});

app.get('/subject-preference/:subCategoryId/syllabus', requireStudentAuth, async (req, res) => {
  try {
    res.json(await subjectPreferenceService.getSyllabus(req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load syllabus' });
  }
});

// GET /subject-preference/:subCategoryId/exam-facts — read-only, student-
// facing verified exam info (finalized requirement, Ask Ponna Exam Coach
// guided flow) -- same VerifiedExamFact data the get_exam_info AI tool
// reads, exposed directly here so the frontend wizard can show it without
// going through the chat/AI round-trip at all for this step.
app.get('/subject-preference/:subCategoryId/exam-facts', requireStudentAuth, async (req, res) => {
  try {
    res.json(await examFactsService.listForExam(req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load exam information' });
  }
});

// GET /cutoff-predictor/:subCategoryId — Cut-off Marks Predictor
// (finalized requirement, paid-only, ₹999 Annual Plan value-add).
app.get('/cutoff-predictor/:subCategoryId', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await cutoffPredictorService.getPrediction(req.studentUserId!, req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load cut-off prediction' });
  }
});

app.get('/subject-preference/:subCategoryId', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const pref = await subjectPreferenceService.getPreference(req.studentUserId!, req.params.subCategoryId);
    res.json(pref ?? { subjectIds: [], topicIds: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load preference' });
  }
});

// POST /subject-preference/:subCategoryId  { subjectIds: string[], topicIds: string[] }
app.post('/subject-preference/:subCategoryId', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const result = await subjectPreferenceService.savePreference(
      req.studentUserId!,
      req.params.subCategoryId,
      req.body.subjectIds ?? [],
      req.body.topicIds ?? [],
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save preference' });
  }
});

app.delete('/subject-preference/:subCategoryId', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    await subjectPreferenceService.clearPreference(req.studentUserId!, req.params.subCategoryId);
    res.json({ cleared: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear preference' });
  }
});

// ── Daily Quiz — Student routes (finalized requirement) ────────────────

// GET /daily-quiz/enabled — public "Coming Soon" gate check, before the
// student is even necessarily on the Daily Quiz page. No student-specific
// data, just the platform-wide toggle.
app.get('/daily-quiz/enabled', async (req, res) => {
  try {
    const settings = await settingsService.get();
    const enabled = req.query.type === 'BRAIN_CHALLENGE' ? settings.brainChallengeEnabled : settings.dailyQuizEnabled;
    res.json({ enabled });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// GET /daily-quiz/state?type=DAILY_QUIZ|BRAIN_CHALLENGE — access gate + today's quiz + any existing attempt's progress.
app.get('/daily-quiz/state', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const quizType = req.query.type === 'BRAIN_CHALLENGE' ? DailyQuizType.BRAIN_CHALLENGE : DailyQuizType.DAILY_QUIZ;
    res.json(await dailyQuizService.getStudentState(req.studentUserId!, quizType));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load quiz' });
  }
});

// POST /daily-quiz/:id/start  { language: 'TA' | 'EN' }
app.post('/daily-quiz/:id/start', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const attempt = await dailyQuizService.startOrResumeAttempt(req.studentUserId!, req.params.id, req.body.language);
    res.json(attempt);
  } catch (err: any) {
    if (err instanceof DailyQuizError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
});

// GET /daily-quiz/attempts/:attemptId/questions — question content in the
// attempt's locked language; unanswered questions never expose the
// correct answer/explanation.
app.get('/daily-quiz/attempts/:attemptId/questions', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await dailyQuizService.getAttemptQuestions(req.studentUserId!, req.params.attemptId));
  } catch (err: any) {
    if (err instanceof DailyQuizError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to load quiz questions' });
  }
});

// POST /daily-quiz/attempts/:attemptId/answer  { questionId, selectedOption }
app.post('/daily-quiz/attempts/:attemptId/answer', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const answer = await dailyQuizService.submitAnswer(req.studentUserId!, req.params.attemptId, req.body.questionId, req.body.selectedOption);
    res.json(answer);
  } catch (err: any) {
    if (err instanceof DailyQuizError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to submit answer' });
  }
});

// POST /daily-quiz/attempts/:attemptId/complete
app.post('/daily-quiz/attempts/:attemptId/complete', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const attempt = await dailyQuizService.completeAttempt(req.studentUserId!, req.params.attemptId);
    res.json(attempt);
  } catch (err: any) {
    if (err instanceof DailyQuizError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to complete quiz' });
  }
});

// ── Daily Quiz / Brain Challenge — Admin routes ──────────────────────

// POST /admin/daily-quiz/validate-csv  { csvText } — preview only, writes nothing.
app.post('/admin/daily-quiz/validate-csv', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(dailyQuizService.parseAndValidateCsv(req.body.csvText));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to validate CSV' });
  }
});

// POST /admin/daily-quiz  { quizDate, publishTimeIst, rows, quizType? }
app.post('/admin/daily-quiz', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    const quizType = req.body.quizType === 'BRAIN_CHALLENGE' ? DailyQuizType.BRAIN_CHALLENGE : DailyQuizType.DAILY_QUIZ;
    const quiz = await dailyQuizService.createDailyQuiz(req.body.quizDate, req.body.publishTimeIst, req.body.rows, quizType);
    res.json(quiz);
  } catch (err: any) {
    if (err instanceof DailyQuizError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// GET /admin/daily-quiz?type=DAILY_QUIZ|BRAIN_CHALLENGE
app.get('/admin/daily-quiz', requireStaffAuth, async (req, res) => {
  try {
    const quizType = req.query.type === 'BRAIN_CHALLENGE' ? DailyQuizType.BRAIN_CHALLENGE : req.query.type === 'DAILY_QUIZ' ? DailyQuizType.DAILY_QUIZ : undefined;
    res.json(await dailyQuizService.listDailyQuizzes(quizType));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list quizzes' });
  }
});

app.get('/admin/daily-quiz/:id', requireStaffAuth, async (req, res) => {
  try {
    res.json(await dailyQuizService.getDailyQuizForAdmin(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Daily Quiz' });
  }
});

// POST /admin/daily-quiz/:id/schedule  { publishTimeIst }
app.post('/admin/daily-quiz/:id/schedule', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await dailyQuizService.updateSchedule(req.params.id, req.body.publishTimeIst));
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

app.delete('/admin/daily-quiz/:id', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    await dailyQuizService.deleteDailyQuiz(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete Daily Quiz' });
  }
});

// GET /students/me/devices — "My Devices" settings list (logged-in only).
app.get('/students/me/devices', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await studentAuthService.listDevices(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load devices' });
  }
});

// DELETE /students/me/devices/:deviceId — remove a device from the
// logged-in "My Devices" page (as opposed to the login-time flow above).
app.delete('/students/me/devices/:deviceId', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    await studentAuthService.removeDevice(req.studentUserId!, req.params.deviceId);
    res.json({ removed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

// POST /students/me/link-google  { firebaseIdToken } — student must already
// be logged in. Frontend calls Firebase's linkWithPopup FIRST (client-side,
// same Firebase uid as their current session), then sends the resulting
// fresh token here to confirm + capture the Google email into Profile.
app.post('/students/me/link-google', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { firebaseIdToken } = req.body;
    const result = await studentAuthService.linkGoogleAccount(req.studentUserId!, firebaseIdToken);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to link Google account' });
  }
});

// POST /students/me/link-phone  { firebaseIdToken } — student must already
// be logged in. Frontend runs Firebase's linkWithPhoneNumber FIRST
// (client-side, same Firebase uid as their current session), then sends
// the resulting token here (finalized requirement — Free Preview requires
// a verified phone, which a Google-only account doesn't have by default).
app.post('/students/me/link-phone', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { firebaseIdToken } = req.body;
    const result = await studentAuthService.linkPhoneNumber(req.studentUserId!, firebaseIdToken);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to link phone number' });
  }
});

// POST /students/me/profile-photo  { imageDataUrl: string } — Part B
// (finalized requirement): lets every student upload their own photo, not
// just Google sign-ins. A student's own upload always takes precedence
// over the Google-auto-captured one (see student-auth.service.ts).
app.post('/students/me/profile-photo', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { imageDataUrl } = req.body;
    const photoUrl = await profilePhotoService.uploadProfilePhoto(req.studentUserId!, imageDataUrl);
    res.json({ photoUrl });
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to upload photo' });
  }
});

// POST /questions/:id/report  { reason, comment? } — student-facing
// "Report an issue" (finalized requirement). Flag-only — never changes
// the question itself.
app.post('/questions/:id/report', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { reason, comment } = req.body;
    const report = await questionReportService.createReport(req.studentUserId!, req.params.id, reason, comment);
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to submit report' });
  }
});

// GET /admin/question-reports?status=OPEN — admin review queue.
app.get('/admin/question-reports', requireStaffAuth, async (req, res) => {
  try {
    const reports = await questionReportService.listReports(req.query.status as any);
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load question reports' });
  }
});

// GET /admin/question-reports/open-count — small nav badge, same pattern as "Waiting for AI".
app.get('/admin/question-reports/open-count', requireStaffAuth, async (_req, res) => {
  try {
    res.json({ count: await questionReportService.countOpen() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to count question reports' });
  }
});

// POST /admin/question-reports/:id/status  { status: 'RESOLVED' | 'DISMISSED' | 'OPEN' }
app.post('/admin/question-reports/:id/status', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    const report = await questionReportService.setStatus(req.params.id, req.body.status);
    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update report status' });
  }
});

// ─────────────────────────────────────────────────────────
// STUDENT ROUTES
// ─────────────────────────────────────────────────────────

// GET /exam-taxonomy — student-facing read of the Authority/Category/Sub-Category
// tree, used by the Practice Preference Setup form's cascading multi-selects.
app.get('/exam-taxonomy', requireStudentAuth, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await examTaxonomyService.listStudentVisibleTree());
});

// GET /students/me/practice-preference — null if not saved yet (first-time student)
app.get('/students/me/practice-preference', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const pref = await practicePreferenceService.get(req.studentUserId!);
    res.json(pref);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load practice preference' });
  }
});

// PUT /students/me/practice-preference  { language, mode, selections }
app.put('/students/me/practice-preference', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { language, mode, selections } = req.body;
    const pref = await practicePreferenceService.save(req.studentUserId!, language, mode, selections);
    res.json(pref);
  } catch (err) {
    if (err instanceof InvalidSelectionError) {
      // Invalid authority combination (e.g. NEET + JEE Main, or two
      // unrelated entrance exams together) — a client-side bug or a
      // deliberate bypass of the frontend, not a server error.
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to save practice preference' });
  }
});

// POST /students/me/practice-preference/available-languages  { selections, mode }
// The LAST step of Setup — given everything selected so far (Purpose,
// Authorities, Categories, Sub-Categories, Difficulty), returns exactly
// which languages actually have Published questions for that combination.
// Never hardcoded — a live query every time, so it stays correct as content grows.
app.post('/students/me/practice-preference/available-languages', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { selections, mode } = req.body;
    const languages = await practicePreferenceService.getAvailableLanguages(selections, mode);
    res.json({ languages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check available languages' });
  }
});

// GET /quiz/access-status — checks the student's saved Practice Preference
// against their active paid Plans WITHOUT starting a session or touching
// quota. Used by Practice Setup to show the Free-fallback upgrade prompt
// ("Practice Free" / "Get Annual Plan") only when genuinely needed — this
// prompt must never appear if an active paid Plan already covers the
// selection (finalized requirement).
app.get('/quiz/access-status', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const preference = await practicePreferenceService.get(req.studentUserId!);
    if (!preference) {
      res.json({ hasPreference: false });
      return;
    }
    const selections = preference.selections as any;
    const covered = await quota.hasUnlimitedAccess(req.studentUserId!, selections);
    if (covered) {
      res.json({ hasPreference: true, covered: true });
      return;
    }
    const applicablePlan = await quota.findApplicablePlan(selections);
    res.json({ hasPreference: true, covered: false, applicablePlanId: applicablePlan?.id ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check access status' });
  }
});

// POST /quiz/start — no body needed. Uses the student's saved Practice
// Preference (Language, Authority/Category/Sub-Category, Difficulty) —
// finalized requirement: setup happens once, every session just reuses it.
app.post('/quiz/start', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const session = await sessionService.startSession(req.studentUserId!);
    res.json(session);
  } catch (err: any) {
    if (err instanceof QuotaExceededError) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Failed to start session' });
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

// POST /quiz/:sessionId/answer  { questionId, selectedOption, timeSpentSeconds? }
app.post('/quiz/:sessionId/answer', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { questionId, selectedOption, timeSpentSeconds } = req.body;
    const result = await sessionService.submitAnswer(req.params.sessionId, questionId, selectedOption, timeSpentSeconds);
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

// PATCH /students/me/profile — finalized Profile redesign: name, dateOfBirth,
// email, whatsappNumber, district, cityTownVillage, educationStatus +
// the one relevant education detail field. See profile.service.ts.
app.patch('/students/me/profile', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const result = await profileService.updateProfile(req.studentUserId!, req.body);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /students/me/reset-history — Test Accounts only (finalized
// requirement). Wipes the account's own quiz history/score, not the
// account itself.
app.post('/students/me/reset-history', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    await profileService.resetOwnHistory(req.studentUserId!);
    res.json({ reset: true });
  } catch (err: any) {
    console.error(err);
    res.status(403).json({ error: err.message ?? 'Failed to reset history' });
  }
});

// ─────────────────────────────────────────────────────────
// PAYMENTS  (§5, §7.6) — Razorpay
// ─────────────────────────────────────────────────────────

// GET /plans — student-facing list of active Plans (Annual Plan redesign).
// Just the fields the purchase page needs; scope details (which exams a
// Plan covers) aren't needed here yet — Phase 3 will expose those for the
// "Choose Your Exams" flow.
app.get('/plans', requireStudentAuth, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await plansService.listActivePlansForStudent());
});

// GET /students/me/subscriptions — this student's currently-active paid
// Subscriptions, for the "My Plans" page's Active Plans section.
app.get('/students/me/subscriptions', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await plansService.listActiveSubscriptionsForStudent(req.studentUserId!));
});

// POST /payments/create-order  { planId: string } — userId comes from the JWT
app.post('/payments/create-order', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    const { planId } = req.body;
    const order = await paymentService.createOrder(req.studentUserId!, planId);
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

// GET /admin/questions?status=DRAFT&difficulty=MEDIUM&page=1&search=piaget&authorityId=...&categoryId=...
app.get('/admin/questions', requireStaffAuth, async (req, res) => {
  try {
    const { status, difficulty, authorityId, categoryId, subCategoryId, category, language, sourceType, search, page, pageSize, noDifficultyOnly } = req.query;
    const result = await questionService.list({
      status: status as any,
      difficulty: difficulty as any,
      authorityId: authorityId as string,
      categoryId: categoryId as string,
      subCategoryId: subCategoryId as string,
      category: category as any,
      language: language as any,
      sourceType: sourceType as any,
      search: search as string,
      noDifficultyOnly: noDifficultyOnly === 'true',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list questions' });
  }
});

// GET /admin/questions/ids — every id matching the current filter,
// regardless of page, for the "Select All (N) Matching Filter" bulk-select
// action. Same query params as GET /admin/questions, minus page/pageSize.
app.get('/admin/questions/ids', requireStaffAuth, async (req, res) => {
  try {
    const { status, difficulty, authorityId, categoryId, subCategoryId, category, language, sourceType, search, noDifficultyOnly } = req.query;
    const ids = await questionService.listIds({
      status: status as any,
      difficulty: difficulty as any,
      authorityId: authorityId as string,
      categoryId: categoryId as string,
      subCategoryId: subCategoryId as string,
      category: category as any,
      language: language as any,
      sourceType: sourceType as any,
      search: search as string,
      noDifficultyOnly: noDifficultyOnly === 'true',
    });
    res.json({ ids });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list question ids' });
  }
});

// GET /admin/questions/stats — Question Bank Stats dashboard: counts per
// Authority → Category → Sub-Category, broken down by status.
// GET /admin/questions/heuristic-classify/preview — dry run of the
// agreed one-time heuristic Difficulty rule (calculation signal, else
// length > 120 chars), writes nothing.
app.get('/admin/questions/heuristic-classify/preview', requireStaffAuth, async (_req, res) => {
  try {
    res.json(await questionService.previewHeuristicClassification());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to preview heuristic classification' });
  }
});

// POST /admin/questions/heuristic-classify/apply — actually applies it.
// Only affects questions with no Difficulty set; never changes status.
app.post('/admin/questions/heuristic-classify/apply', requireStaffAuth, requireRole('SUPER_ADMIN'), async (_req, res) => {
  try {
    res.json(await questionService.applyHeuristicClassification());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to apply heuristic classification' });
  }
});

app.get('/admin/questions/stats', requireStaffAuth, async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await questionService.getTaxonomyStats());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load question bank stats' });
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
  try {
    const question = await questionService.setStatus(req.params.id, statusMap[req.params.action as 'publish' | 'disable' | 'draft']);
    res.json(question);
  } catch (err) {
    if (err instanceof NoDifficultySetError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
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

// POST /admin/questions/bulk-set-difficulty  { ids: string[], difficulty: 'MEDIUM' | 'HARD' }
app.post('/admin/questions/bulk-set-difficulty', requireStaffAuth, canEditQuestions, async (req, res) => {
  const result = await questionService.bulkSetDifficulty(req.body.ids, req.body.difficulty);
  res.json(result);
});

// POST /admin/questions/bulk-update-metadata  { ids: string[], sourceType?, categoryId?, subCategoryId?, examName?, subjectName?, sourceName? }
// Every field is optional — a field left out is untouched on every selected question.
app.post('/admin/questions/bulk-update-metadata', requireStaffAuth, canEditQuestions, async (req, res) => {
  try {
    const { ids, ...fields } = req.body;
    const result = await questionService.bulkUpdateMetadata(ids, fields);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to bulk-update metadata' });
  }
});

// POST /admin/questions/bulk-delete  { ids: string[] } — Super Admin only, this is destructive
app.post('/admin/questions/bulk-delete', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const result = await questionService.bulkDelete(req.body.ids);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Failed to delete questions' });
  }
});

// POST /admin/questions/bulk-force-delete  { ids: string[] } — Super Admin only.
// QA/launch-prep tool: permanently deletes even questions with answer
// history. Never expose this to anyone but Super Admin, and never call it
// once real students are using the platform.
app.post('/admin/questions/bulk-force-delete', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const result = await questionService.forceBulkDelete(req.body.ids);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Failed to force-delete questions' });
  }
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

// POST /admin/questions/bulk-upload/preview  (multipart form, field name "file")
// Phase 1 — parses, validates, exact-duplicate-checks. Writes NOTHING to the
// database yet; the admin reviews the summary/list before confirming import.
app.post(
  '/admin/questions/bulk-upload/preview',
  requireStaffAuth,
  canEditQuestions,
  upload.single('file'),
  async (req: AuthedRequest, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
      const csvContent = req.file.buffer.toString('utf-8');
      const result = await bulkUploadService.preview(csvContent);
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Preview failed — check the CSV format' });
    }
  },
);

// POST /admin/questions/bulk-upload/confirm
// Phase 2 — { rows: PreviewRow['data'][], batchMeta: {...} }. Only the rows
// the admin approved (valid, non-duplicate) should be sent here — the
// frontend filters preview results down to 'valid' before calling this.
app.post('/admin/questions/bulk-upload/confirm', requireStaffAuth, canEditQuestions, async (req: AuthedRequest, res) => {
  try {
    const { rows, batchMeta } = req.body;
    const { batchId, inserted } = await bulkUploadService.confirmImport(rows, batchMeta, req.staff!.staffId);

    // Kick off AI classification for this batch in the background — see
    // note in the previous version of this route for why this is
    // fire-and-forget rather than awaited.
    classificationService.classifyPendingQuestions(batchId).catch((err) =>
      console.error(`Background classification failed for batch ${batchId}:`, err),
    );

    res.json({ batchId, inserted });
  } catch (err: any) {
    console.error(err);
    // Surface the real reason directly on the page — a bare "Import
    // failed" with no detail meant every failure needed a trip to Render
    // logs just to find out what actually broke.
    res.status(500).json({ error: err.message ?? 'Import failed' });
  }
});

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
// EXAM TAXONOMY — Purpose → Authority → Category → Sub-Category (dynamic, Super Admin managed)
// ─────────────────────────────────────────────────────────

// GET /admin/exam-taxonomy — full tree, for the Taxonomy Management page and cascading dropdowns
app.get('/admin/exam-taxonomy', requireStaffAuth, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await examTaxonomyService.listFullTree());
});

// ── Subject & Topic Preference — Master Structure (finalized requirement) ──
// Admin-only, master data for now — no student-facing routes yet.

app.get('/admin/syllabus/exams', requireStaffAuth, async (_req, res) => {
  try {
    res.json(await syllabusService.listTnpscExams());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list TNPSC exams' });
  }
});

app.get('/admin/syllabus/:subCategoryId', requireStaffAuth, async (req, res) => {
  try {
    res.json(await syllabusService.getSyllabus(req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load syllabus' });
  }
});

app.post('/admin/syllabus/:subCategoryId/subjects', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await syllabusService.createSubject(req.params.subCategoryId, req.body.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add subject' });
  }
});

app.patch('/admin/syllabus/subjects/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await syllabusService.renameSubject(req.params.id, req.body.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rename subject' });
  }
});

app.delete('/admin/syllabus/subjects/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await syllabusService.deleteSubject(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// POST /admin/syllabus/subjects/:id/topics  { name } OR { names: string[] } (bulk)
app.post('/admin/syllabus/subjects/:id/topics', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    if (Array.isArray(req.body.names)) {
      res.json(await syllabusService.createTopicsBulk(req.params.id, req.body.names));
    } else {
      res.json(await syllabusService.createTopic(req.params.id, req.body.name));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add topic(s)' });
  }
});

app.patch('/admin/syllabus/topics/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await syllabusService.renameTopic(req.params.id, req.body.name));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to rename topic' });
  }
});

app.delete('/admin/syllabus/topics/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await syllabusService.deleteTopic(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete topic' });
  }
});

// ── Verified Exam Facts — admin management (finalized requirement, Ask
// Ponna Exam Preparation Coach) ─────────────────────────────────────────

app.get('/admin/exam-facts/:subCategoryId', requireStaffAuth, async (req, res) => {
  try {
    res.json(await examFactsService.listForExam(req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load exam facts' });
  }
});

app.post('/admin/exam-facts/:subCategoryId', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await examFactsService.create(req.params.subCategoryId, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add exam fact' });
  }
});

app.patch('/admin/exam-facts/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await examFactsService.update(req.params.id, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update exam fact' });
  }
});

app.delete('/admin/exam-facts/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await examFactsService.delete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete exam fact' });
  }
});

// ── Cut-off Marks Predictor — admin management (finalized requirement) ────

app.get('/admin/cutoffs/:subCategoryId', requireStaffAuth, async (req, res) => {
  try {
    res.json(await cutoffService.listForExam(req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load cut-off records' });
  }
});

app.post('/admin/cutoffs/:subCategoryId', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await cutoffService.create(req.params.subCategoryId, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add cut-off record' });
  }
});

app.patch('/admin/cutoffs/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await cutoffService.update(req.params.id, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cut-off record' });
  }
});

app.delete('/admin/cutoffs/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await cutoffService.delete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete cut-off record' });
  }
});

// ── Ask Ponna Master Requirement -- Current Affairs (admin, BINDING) ────
app.get('/admin/current-affairs', requireStaffAuth, async (_req, res) => {
  try {
    res.json(await currentAffairsService.list());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load current affairs' });
  }
});
app.post('/admin/current-affairs', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await currentAffairsService.create(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add current affairs item' });
  }
});
app.delete('/admin/current-affairs/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await currentAffairsService.delete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete current affairs item' });
  }
});

// ── Ask Ponna Master Requirement -- PONNA Feature FAQ (admin, BINDING) ──
app.get('/admin/ponna-faq', requireStaffAuth, async (req, res) => {
  try {
    res.json(await ponnaFaqService.list(req.query.featureKey as string | undefined));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load PONNA FAQ' });
  }
});
app.post('/admin/ponna-faq', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await ponnaFaqService.create(req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add FAQ entry' });
  }
});
app.patch('/admin/ponna-faq/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await ponnaFaqService.update(req.params.id, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update FAQ entry' });
  }
});
app.delete('/admin/ponna-faq/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await ponnaFaqService.delete(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete FAQ entry' });
  }
});

// ── Ask Ponna Master Requirement -- Official Data Import Workflow
// (admin, Spec v5 Refinement 3, BINDING) ────────────────────────────────
app.post('/admin/notification-imports/:subCategoryId', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await notificationImportService.createImport(req.params.subCategoryId, req.body.rawText, req.body.sourceUrl));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create import' });
  }
});
app.get('/admin/notification-imports', requireStaffAuth, async (_req, res) => {
  try {
    res.json(await notificationImportService.listPending());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load pending imports' });
  }
});
app.get('/admin/notification-imports/:id', requireStaffAuth, async (req, res) => {
  try {
    res.json(await notificationImportService.getImport(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load import' });
  }
});
app.patch('/admin/notification-import-candidates/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await notificationImportService.updateCandidate(req.params.id, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update candidate' });
  }
});
app.post('/admin/notification-import-candidates/:id/approve', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await notificationImportService.approveCandidate(req.params.id, req.body.verifiedAt));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve candidate' });
  }
});
app.delete('/admin/notification-import-candidates/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await notificationImportService.discardCandidate(req.params.id);
    res.json({ discarded: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to discard candidate' });
  }
});
app.post('/admin/notification-imports/:id/mark-reviewed', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await notificationImportService.markReviewed(req.params.id);
    res.json({ reviewed: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark reviewed' });
  }
});

// ── Live Exam / Mock Exam — admin configuration (finalized requirement) ───

app.get('/admin/mock-exam/:subCategoryId', requireStaffAuth, async (req, res) => {
  try {
    res.json(await mockExamAdminService.getConfig(req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Live Exam config' });
  }
});

app.post('/admin/mock-exam/:subCategoryId', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    res.json(await mockExamAdminService.upsertConfig(req.params.subCategoryId, req.body));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save Live Exam config' });
  }
});

app.delete('/admin/mock-exam/:subCategoryId', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req, res) => {
  try {
    await mockExamAdminService.deleteConfig(req.params.subCategoryId);
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete Live Exam config' });
  }
});

// ── Live Exam / Mock Exam — student-facing (finalized requirement) ────────

app.get('/live-exam/:subCategoryId/state', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await mockExamService.getState(req.studentUserId!, req.params.subCategoryId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load Live Exam' });
  }
});

app.post('/live-exam/:subCategoryId/start', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await mockExamService.startAttempt(req.studentUserId!, req.params.subCategoryId));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to start Live Exam' });
  }
});

app.get('/live-exam/attempts/:attemptId/questions', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await mockExamService.getQuestions(req.studentUserId!, req.params.attemptId));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to load questions' });
  }
});

app.post('/live-exam/attempts/:attemptId/answer', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await mockExamService.submitAnswer(req.studentUserId!, req.params.attemptId, req.body.questionId, req.body.selectedOption));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to save answer' });
  }
});

app.post('/live-exam/attempts/:attemptId/submit', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await mockExamService.submitExam(req.studentUserId!, req.params.attemptId));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to submit Live Exam' });
  }
});

// ── Diagnostic Quiz at Signup (finalized requirement) ──────────────────

app.get('/diagnostic/state', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await diagnosticService.getState(req.studentUserId!));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load diagnostic state' });
  }
});

app.post('/diagnostic/start', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await diagnosticService.start(req.studentUserId!, req.body?.subCategoryId));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to start diagnostic' });
  }
});

app.get('/diagnostic/attempts/:attemptId/questions', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await diagnosticService.getQuestions(req.studentUserId!, req.params.attemptId));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to load questions' });
  }
});

app.post('/diagnostic/attempts/:attemptId/answer', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await diagnosticService.submitAnswer(req.studentUserId!, req.params.attemptId, req.body.questionId, req.body.selectedOption));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to submit answer' });
  }
});

app.post('/diagnostic/attempts/:attemptId/complete', requireStudentAuth, async (req: StudentAuthedRequest, res) => {
  try {
    res.json(await diagnosticService.complete(req.studentUserId!, req.params.attemptId));
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to complete diagnostic' });
  }
});

// GET /admin/subjects — for the Bulk Upload / Add Question forms'
// type-with-suggestions Subject field. No POST route: a Subject is
// created automatically (find-or-create by name) the first time it's
// used on a question, not through a separate admin step.
app.get('/admin/subjects', requireStaffAuth, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await questionService.listSubjects());
});

// POST /admin/exam-taxonomy/purposes  { name, nameTa? } — Super Admin only
app.post('/admin/exam-taxonomy/purposes', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.createPurpose(req.body.name, req.body.nameTa));
});

// PATCH /admin/exam-taxonomy/purposes/:purposeId  { allowMultipleAuthorities } — Super Admin only
app.patch('/admin/exam-taxonomy/purposes/:purposeId', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.setPurposeConfig(req.params.purposeId, req.body));
});

// POST /admin/exam-taxonomy/purposes/:purposeId/authorities  { name } — Super Admin only
app.post('/admin/exam-taxonomy/purposes/:purposeId/authorities', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.createAuthority(req.params.purposeId, req.body.name, req.body.selectionGroup));
});

// PATCH /admin/exam-taxonomy/authorities/:authorityId  { allowAllCategories?, difficultyEnabled? } — Super Admin only
app.patch('/admin/exam-taxonomy/authorities/:authorityId', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.setAuthorityConfig(req.params.authorityId, req.body));
});

// PATCH /admin/exam-taxonomy/sub-categories/:id  { studentVisible: boolean }
app.patch('/admin/exam-taxonomy/sub-categories/:id', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.setSubCategoryVisible(req.params.id, req.body.studentVisible));
});

// POST /admin/exam-taxonomy/authorities/:authorityId/categories  { name }
app.post('/admin/exam-taxonomy/authorities/:authorityId/categories', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.createCategory(req.params.authorityId, req.body.name));
});

// POST /admin/exam-taxonomy/categories/:categoryId/sub-categories  { name }
app.post('/admin/exam-taxonomy/categories/:categoryId/sub-categories', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  res.json(await examTaxonomyService.createSubCategory(req.params.categoryId, req.body.name));
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

// POST /admin/students/:id/test-account  { isTestAccount: boolean } — Super Admin only (finalized requirement)
app.post('/admin/students/:id/test-account', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const result = await studentManagementService.setTestAccount(req.params.id, !!req.body.isTestAccount);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update test account status' });
  }
});

// POST /admin/students/:id/clear-suspicious-flag — Super Admin only (finalized requirement, flag-only anti-abuse)
app.post('/admin/students/:id/clear-suspicious-flag', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const result = await studentManagementService.clearSuspiciousFlag(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to clear suspicious flag' });
  }
});

// POST /admin/students/:id/change-phone  { newPhone } — Super Admin only.
// Changes the phone number on an EXISTING account, keeping all its
// history/data. Bypasses OTP verification of the new number, so this is
// a deliberate trusted-admin override, not a self-service flow.
app.post('/admin/students/:id/change-phone', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const result = await studentManagementService.changePhoneNumber(req.params.id, req.body.newPhone);
    res.json(result);
  } catch (err: any) {
    console.error(err);
    res.status(400).json({ error: err.message ?? 'Failed to change phone number' });
  }
});

// DELETE /admin/students/:id — Super Admin only. Permanently deletes the
// account and everything tied to it. Irreversible.
app.delete('/admin/students/:id', requireStaffAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    await studentManagementService.deleteStudentAccount(req.params.id);
    res.json({ deleted: true });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message ?? 'Failed to delete student account' });
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
    res.json(await plansService.updatePlanPrice(req.params.id, req.body.regularPrice, req.body.launchPrice));
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

// Last-resort error handler (Express requires exactly 4 params to recognize
// this as one). Catches anything that failed BEFORE reaching a route's own
// try/catch — e.g. a request body over the express.json() size limit, or
// malformed JSON — and always returns JSON, never Express's default HTML
// error page. Without this, such failures looked like "nothing happens" on
// the frontend: adminFetch's `await res.json()` would throw on the HTML
// body, so the UI never displayed any error at all.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  const status = err.status || err.statusCode || 500;
  const message =
    err.type === 'entity.too.large'
      ? 'This upload is too large — try splitting it into smaller batches.'
      : 'Something went wrong. Please try again.';
  res.status(status).json({ error: message });
});
