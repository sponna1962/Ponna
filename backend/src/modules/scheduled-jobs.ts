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
import { adminAlertService } from './payments/admin-alert.service';
import { dailyEmailService, currentAffairsUploadedToday } from './notifications/daily-email.service';
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

  // Oct 2026 — daily e-mails (Asia/Kolkata). Each kind is sent at most once per
  // IST day (DailyEmailLog), so the retry windows below are safe: they just
  // wait until the day's content exists, then send once.
  const IST = { timezone: 'Asia/Kolkata' } as const;
  const runEmail = (kind: 'MORNING' | 'CURRENT_AFFAIRS' | 'QUIZ') => async () => {
    try { await dailyEmailService.sendDaily(kind); } catch (err) { console.error(`[cron] Daily email ${kind} failed:`, err); }
  };
  cron.schedule('30 6 * * *', runEmail('MORNING'), IST);
  cron.schedule('*/10 17-20 * * *', runEmail('CURRENT_AFFAIRS'), IST); // from 5 PM, as soon as today's items are uploaded
  cron.schedule('*/10 19-22 * * *', runEmail('QUIZ'), IST);
  // Push (own opt-in list): streak-broken nudge at 8 AM; current-affairs alert once today's items exist.
  cron.schedule('0 8 * * *', async () => {
    try {
      const r = await pushNotificationService.notifyStreakBroken();
      if (r.sent > 0) console.log(`[cron] Streak-broken push: sent ${r.sent}`);
    } catch (err) { console.error('[cron] Streak-broken push failed:', err); }
  }, IST);
  cron.schedule('*/10 17-20 * * *', async () => {
    try {
      if (!(await currentAffairsUploadedToday())) return;
      if (!(await dailyEmailService.claimOnce('CA_PUSH'))) return;
      const r = await pushNotificationService.notifyCurrentAffairsReady();
      console.log(`[cron] Current-affairs push: sent ${r.sent}`);
    } catch (err) { console.error('[cron] Current-affairs push failed:', err); }
  }, IST); // from 7 PM, as soon as today's quiz is live

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
  // 5 PM IST daily (explicit timezone, independent of server clock); the
  // quiz is published at 6 PM IST and stays live until 6 PM the next day.
  //
  // Oct 2026 — catch-up: runs every 20 minutes from 17:00 to 20:40 IST. The
  // generators are idempotent (a quiz that already exists for today is
  // returned untouched), so a transient AI/DB failure or a deploy restart at
  // 17:00 is simply retried at the next slot. If today's quiz is STILL
  // missing at the last slot, the owner gets a Telegram/push alert.
  let dailyContentRunning = false;
  cron.schedule('*/20 17-20 * * *', async () => {
    if (dailyContentRunning) return;
    dailyContentRunning = true;
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const isLastSlot = now.getHours() === 20 && now.getMinutes() >= 40;
    const failed: string[] = [];
    try {
      try {
        const result = await dailyCurrentAffairsService.generateDailyBatch();
        if (result.skippedNoResults) {
          console.log('[cron] Daily Current Affairs: insufficient fresh verified events/questions; nothing created');
          failed.push('Daily Quiz (போதுமான புதிய செய்திகள் இல்லை)');
        } else if (result.created > 0) {
          console.log(`[cron] Daily Current Affairs: created ${result.created} verified Daily Quiz questions`);
        }
      } catch (err: any) {
        console.error('[cron] Daily Current Affairs generation failed:', err);
        failed.push(`Daily Quiz (${String(err?.message ?? err).slice(0, 120)})`);
      }
      try {
        const brain = await dailyCurrentAffairsService.generateBrainChallenge();
        if (brain.created > 0) console.log(`[cron] Brain Challenge: created ${brain.created}`);
      } catch (err: any) {
        console.error('[cron] Brain Challenge generation failed:', err);
        failed.push(`Brain Challenge (${String(err?.message ?? err).slice(0, 120)})`);
      }
      if (isLastSlot && failed.length > 0) {
        adminAlertService.notify('⚠️ PONNA: இன்றைய தினசரி தேர்வு உருவாகவில்லை', `${failed.join('\n')}\nAdmin பக்கத்தில் Generate அழுத்தவும்.`, '/admin');
      }
    } finally { dailyContentRunning = false; }
  }, { timezone: 'Asia/Kolkata' });

  console.log('Scheduled jobs started: abandonment sweep, rank recomputation, suspicious-usage sweep, Daily Quiz status sweep, WhatsApp reminder sweep, push practice reminder sweep, Live Exam weekend reminder, and 48-hour verified Daily Current Affairs generation');
}
