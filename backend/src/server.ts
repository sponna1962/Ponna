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
import { activitySummaryService } from './modules/students/activity-summary.service';
import { guestDiagnosticService } from './modules/students/guest-diagnostic.service';
import { gapAnalysisService } from './modules/practice-preference/gap-analysis.service';
import { weakAreaService } from './modules/practice-preference/weak-area.service';
import { progressCoachService } from './modules/practice-preference/progress-coach.service';
import { runIdempotencyDiagnostic } from './modules/diagnostics/idempotency-diagnostic.service';
import { examCountdownService } from './modules/practice-preference/exam-countdown.service';
import { offlinePracticeService } from './modules/practice-preference/offline-practice.service';
import { syllabusImportService } from './modules/admin/syllabus-import.service';
import { examDataImportService } from './modules/admin/exam-data-import.service';
import { pushNotificationService } from './modules/notifications/push-notification.service';
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
import { questionAuditService } from './modules/audit/question-audit.service';
import { bulkExplanationService } from './modules/questions/bulk-explanation.service';
import { studyNotesService } from './modules/admin/study-notes.service';
import { dailyCurrentAffairsService } from './modules/admin/daily-current-affairs.service';
import { subjectClassificationService } from './modules/questions/subject-classification.service';
import { questionAuditAdminService } from './modules/audit/question-audit-admin.service';
import { htmlEntityCleanupService } from './modules/admin/html-entity-cleanup.service';
import { StudentReviewService } from './modules/questions/student-review.service';
import { MistakeReviewService } from './modules/questions/mistake-review.service';
import { smartRevisionService } from './modules/questions/smart-revision.service';
import { AskPonnaService, AskPonnaAccessError, AskPonnaLimitError } from './modules/ask-ponna/ask-ponna.service';
import { getNudge as getAskPonnaNudge } from './modules/ask-ponna/nudge';
import { getStreakDisplay } from './modules/practice-preference/streak.service';
import { ShareProgressService } from './modules/practice-preference/share-progress.service';
import { ReferralService } from './modules/practice-preference/referral.service';
import { MilestoneService } from './modules/practice-preference/milestone.service';
import { getTimeAnalytics } from './modules/practice-preference/time-analytics.service';
import { SubjectPreferenceService, SubjectPreferenceError } from './modules/practice-preference/subject-preference.service';
import { DailyQuizService, DailyQuizError } from './modules/daily-quiz/daily-quiz.service';
import { SyllabusService } from './modules/admin/syllabus.service';
import { ExamFactsService } from './modules/admin/exam-facts.service';
import { CutoffService } from './modules/admin/cutoff.service';
import { CurrentAffairsService } from './modules/admin/current-affairs.service';
import { PonnaFaqService } from './modules/admin/ponna-faq.service';
import { NotificationImportService } from './modules/admin/notification-import.service';
import { CutoffPredictorService } from './modules/practice-preference/cutoff-predictor.service';
import { ScopeRestrictedError, scopeAccessService } from './modules/quota/scope-access.service';
import { MockExamAdminService } from './modules/admin/mock-exam-admin.service';
import { MockExamService } from './modules/quiz/mock-exam.service';
import { adaptiveMockService } from './modules/quiz/adaptive-mock.service';
import { DiagnosticService } from './modules/quiz/diagnostic.service';
import { DailyQuizType } from '@prisma/client';
import { prisma } from './lib/prisma';
import { ProfileService } from './modules/profile/profile.service';

const app = express();
// Render sits behind a reverse proxy — without this, req.ip would always
// be the proxy's own internal address (the same for every request),
// making the suspicious-usage sweep's signup-IP-clustering signal useless
// (finalized requirement). `true` trusts the immediate proxy's
// X-Forwarded-For header, which is what Render's edge sets.
app.set('trust proxy', true);
// CORS: production can be served from the main PONNA domain or its Vercel
// deployment, while local development can still use localhost. Do not rely
// on a stale FRONTEND_URL value left over from the old hosting setup.
const allowedOrigins = new Set([
  'https://ponna.in',
  'https://www.ponna.in',
  'https://ponna-chi.vercel.app',
]);
const configuredFrontendUrl = process.env.FRONTEND_URL?.trim();
if (configuredFrontendUrl) allowedOrigins.add(configuredFrontendUrl.replace(/\/$/, ''));
app.use(cors({
  origin: (origin, callback) => {
    // Non-browser tools and same-origin requests do not send Origin.
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    // Permit Vercel preview deployments for the PONNA project.
    if (/^https:\/\/ponna-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));
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
const adaptiveMockService = new AdaptiveMockService();
const diagnosticService = new DiagnosticService();
const shareProgressService = new ShareProgressService();
const referralService = new ReferralService();
const milestoneService = new MilestoneService();
const profileService = new ProfileService();