// Scheduled Jobs — wires the background processes for sessions, ranking,
// abuse detection, Daily Quiz status, reminders, and daily AI content.

import cron from 'node-cron';
import { SessionService } from './quiz/session.service';
import { RankingService } from './ranking/ranking.service';
import { AntiAbuseService } from './anti-abuse/anti-abuse.service';
import { DailyQuizService } from './daily-quiz/daily-quiz.service';
import { runWhatsAppReminderSweep } from './notifications/whatsapp-reminder.service';
import { pushNotificationService } from './notifications/push-notification.service';
import { questionAuditService } from './audit/question-audit.service';
import { dailyCurrentAffairsService } from './admin/daily-current-affairs.service';
import { prisma } from '../lib/prisma';

const sessionService = new SessionService();
const rankingService = new RankingService();
const antiAbuseService = new AntiAbuseService();
const dailyQuizService = new DailyQuizService();

export function startScheduledJobs() {
  questionAuditService.resumeStaleRuns().catch((err) => console.error('[startup] resumeStaleRuns failed:', err));

  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await sessionService.sweepAbandonedSessions();
      if (result.abandonedCount > 0) console.log(`[cron] Abandoned ${result.abandonedCount} stale session(s)`);
    } catch (err) { console.error('[cron] Abandonment sweep failed:', err); }
  });

  cron.schedule('0 * * * *', async () => {
    try { await rankingService.recomputeAllBuckets(); console.log('[cron] Rank recomputation complete'); }
    catch (err) { console.error('[cron] Rank recomputation failed:', err); }
  });

  cron.schedule('50 23 * * *', async () => {
    try {
      const result = await antiAbuseService.runDailySweep();
      console.log(`[cron] Suspicious-usage sweep: checked ${result.checked}, flagged ${result.flaggedCount}`);
    } catch (err) { console.error('[cron] Suspicious-usage sweep failed:', err); }
  });

  cron.schedule('* * * * *', async () => {
    try {
      const result = await dailyQuizService.runStatusSweep();
      if (result.published > 0) {
        pushNotificationService.notifyDailyChallengeReady().catch((err) => console.error('[cron] Daily Challenge push notification failed:', err));
      }
    } catch (err) { console.error('[cron] Daily Quiz status sweep failed:', err); }
  });

  cron.schedule('30 13 * * *', async () => {
    try {
      const result = await pushNotificationService.sendPracticeReminders();
      if (result.sent > 0) console.log(`[cron] Push practice reminders: sent ${result.sent}`);
    } catch (err) { console.error('[cron] Push practice reminder sweep failed:', err); }
  });

  cron.schedule('30 12 * * 5', async () => {
    try {
      const result = await pushNotificationService.notifyLiveExamWeekendReminder();
      if (result.sent > 0) console.log(`[cron] Live Exam weekend reminder: sent ${result.sent}`);
    } catch (err) { console.error('[cron] Live Exam weekend reminder failed:', err); }
  });

  cron.schedule('30 2 * * *', async () => {
    try {
      const result = await runWhatsAppReminderSweep();
      if (result.sent > 0 || result.failed > 0) {
        console.log(`[cron] WhatsApp reminder sweep: sent ${result.sent}, failed ${result.failed}, skipped (no phone) ${result.skippedNoPhone}`);
      }
    } catch (err) { console.error('[cron] WhatsApp reminder sweep failed:', err); }
  });

  // Daily Current Affairs generation.
  // HARD RULE: only events from the rolling previous 48 hours are eligible.
  // The service performs two verification passes (discovery + independent
  // verification). Old/recycled news is rejected. If 10 fresh verified events
  // cannot be established, nothing is created; old news is never used as filler.
  // Generated questions go directly to DailyQuiz/DailyQuizQuestion and NEVER
  // to the normal Question/DRAFT bank.
  cron.schedule('30 6 * * *', async () => {
    try {
      const result = await dailyCurrentAffairsService.generateDailyBatch();
      if (result.skippedNoResults) {
        console.log('[cron] Daily Current Affairs: insufficient fresh verified events/questions; nothing created');
      } else {
        console.log(`[cron] Daily Current Affairs: created ${result.created} verified Daily Quiz questions`);
      }
    } catch (err) { console.error('[cron] Daily Current Affairs generation failed:', err); }
  });

  console.log('Scheduled jobs started: abandonment sweep, rank recomputation, suspicious-usage sweep, Daily Quiz status sweep, WhatsApp reminder sweep, push practice reminder sweep, Live Exam weekend reminder, and 48-hour verified Daily Current Affairs generation');
}
