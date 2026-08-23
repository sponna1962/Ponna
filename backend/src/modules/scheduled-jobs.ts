// Scheduled Jobs — wires the two background processes that were previously
// callable-but-unscheduled: the quiz session abandonment sweep (§4.3) and
// rank recomputation (§8.1). Imported once from server.ts on startup.

import cron from 'node-cron';
import { SessionService } from './quiz/session.service';
import { RankingService } from './ranking/ranking.service';

const sessionService = new SessionService();
const rankingService = new RankingService();

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

  console.log('Scheduled jobs started: abandonment sweep (every 15 min), rank recomputation (hourly)');
}
