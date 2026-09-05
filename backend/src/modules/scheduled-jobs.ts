// Scheduled Jobs — wires the two background processes that were previously
// callable-but-unscheduled: the quiz session abandonment sweep (§4.3) and
// rank recomputation (§8.1). Imported once from server.ts on startup.

import cron from 'node-cron';
import { SessionService } from './quiz/session.service';
import { RankingService } from './ranking/ranking.service';
import { AntiAbuseService } from './anti-abuse/anti-abuse.service';
import { DailyQuizService } from './daily-quiz/daily-quiz.service';
import { runWhatsAppReminderSweep } from './notifications/whatsapp-reminder.service';

const sessionService = new SessionService();
const rankingService = new RankingService();
const antiAbuseService = new AntiAbuseService();
const dailyQuizService = new DailyQuizService();

export function startScheduledJobs() {
  // Every 15 minutes: mark stale in-progress sessions as Abandoned, release
  // their questions back to the pool, and (per §4.3/§5) do NOT refund quota.
  cron.schedule('*/15 * * * *', async () => {
    try {
      const result = await sessionService.sweepAbandonedSessions();
      if (result.abandonedCount > 0) {
        console.log(`[cron] Abandoned ${result.abandonedCount} stale session(s)`);
      }
    } catch (err) {
      console.error('[cron] Abandonment sweep failed:', err);
    }
  });

  // Hourly: recompute rank for all three buckets. Ranking doesn't need to be
  // real-time-exact (§8.1), so this cadence is deliberately not per-request.
  cron.schedule('0 * * * *', async () => {
    try {
      await rankingService.recomputeAllBuckets();
      console.log('[cron] Rank recomputation complete');
    } catch (err) {
      console.error('[cron] Rank recomputation failed:', err);
    }
  });

  // Daily at 23:50 IST-adjacent-ish (server timezone — deliberately just
  // before typical calendar-day rollover) — suspicious-usage sweep
  // (finalized requirement, flag-only, never auto-blocks).
  cron.schedule('50 23 * * *', async () => {
    try {
      const result = await antiAbuseService.runDailySweep();
      console.log(`[cron] Suspicious-usage sweep: checked ${result.checked}, flagged ${result.flaggedCount}`);
    } catch (err) {
      console.error('[cron] Suspicious-usage sweep failed:', err);
    }
  });

  // Daily Quiz status sweep (finalized requirement) — every minute,
  // SCHEDULED->PUBLISHED and PUBLISHED->EXPIRED. Display/admin
  // convenience only — the student-facing API re-checks publishAt/
  // expiresAt live regardless, so a delay here is never a security gap.
  cron.schedule('* * * * *', async () => {
    try {
      await dailyQuizService.runStatusSweep();
    } catch (err) {
      console.error('[cron] Daily Quiz status sweep failed:', err);
    }
  });

  // WhatsApp Daily Reminder sweep (finalized requirement) — once daily.
  // No-ops entirely (returns zeros) if whatsappReminderEnabled is false
  // or WHATSAPP_ACCESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID aren't set yet, so
  // this is always safe to leave scheduled even before those are
  // configured. NOTE: this schedule string is in the SERVER's own
  // timezone, not explicitly converted to IST like Daily Quiz's
  // publishAt/expiresAt are -- worth revisiting once the actual Render
  // server timezone is confirmed, same caveat already true of the
  // suspicious-usage sweep above.
  cron.schedule('30 2 * * *', async () => {
    try {
      const result = await runWhatsAppReminderSweep();
      if (result.sent > 0 || result.failed > 0) {
        console.log(`[cron] WhatsApp reminder sweep: sent ${result.sent}, failed ${result.failed}, skipped (no phone) ${result.skippedNoPhone}`);
      }
    } catch (err) {
      console.error('[cron] WhatsApp reminder sweep failed:', err);
    }
  });

  console.log('Scheduled jobs started: abandonment sweep (every 15 min), rank recomputation (hourly), suspicious-usage sweep (daily), Daily Quiz status sweep (every minute), WhatsApp reminder sweep (daily)');
}
