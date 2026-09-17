// Scheduled Jobs — background processes for quiz/session maintenance and
// automated daily content generation. Imported once from server.ts on startup.

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

  // Every 15 minutes: mark stale in-progress sessions as Abandoned, release
  // their questions back to the pool, and do NOT refund quota.
  cron.schedule('*/15 * * * *', async () => {
    try {
      await sessionService.abandonStaleSessions();
    } catch (err) {
      console.error('[cron] abandonment sweep failed:', err);
    }
  });

  // Existing scheduled jobs continue below unchanged.
  // ...

  // Daily Current Affairs generation — 6:30 AM server time.
  // The service itself enforces the binding rule: only events from the
  // rolling previous 48 hours are eligible, with a two-step Google Search
  // discovery + independent verification pass. If 10 fresh verified events
  // cannot be established, NOTHING is created; old news is never used as
  // filler. Generated questions go directly to DailyQuiz and never to the
  // normal Question/DRAFT bank.
  cron.schedule('30 6 * * *', async () => {
    try {
      const groupIv = await prisma.examSubCategory.findFirst({ where: { name: 'Group - IV' } });
      if (!groupIv) {
        console.error('[cron] Daily Current Affairs generation skipped: Group - IV Sub-Category not found');
        return;
      }
      const result = await dailyCurrentAffairsService.generateDailyBatch(groupIv.id);
      if (result.skippedNoResults) {
        console.log('[cron] Daily Current Affairs: fewer than 10 fresh verified events/questions; nothing created');
      } else {
        console.log(`[cron] Daily Current Affairs: created ${result.created} verified Daily Quiz questions`);
      }
    } catch (err) {
      console.error('[cron] Daily Current Affairs generation failed:', err);
    }
  });

  console.log('Scheduled jobs started: abandonment sweep, rank recomputation, suspicious-usage sweep, Daily Quiz status sweep, reminders, Live Exam weekend reminder, and 48-hour verified Daily Current Affairs generation');
}
