// Additive Current Affairs learning routes. Preloaded by backend dev/start so
// the large server.ts stays untouched while this feature gets its own routes.
import express from 'express';
import cron from 'node-cron';
import { requireStaffAuth, requireRole } from './modules/admin/staff-auth.service';
import { currentAffairsLearningService } from './modules/admin/current-affairs-learning.service';

let installed = false;

function install(app: any) {
  if (installed) return;
  installed = true;

  // Use Express' Router API directly. The previous implementation patched
  // application.get/post/delete and then called captured overloaded methods;
  // in production that caused handlers to receive incorrect arguments and
  // resulted in `res.json is not a function` / `res.status is not a function`.
  app.route('/current-affairs').get(async (req: any, res: any) => {
    try {
      const limit = Number(req.query.limit) || 1200;
      res.json(await currentAffairsLearningService.list(limit));
    } catch (err) {
      console.error('[current-affairs] list failed', err);
      res.status(500).json({ error: 'Failed to load current affairs' });
    }
  });

  app.route('/admin/current-affairs-learning').get(
    requireStaffAuth,
    async (_req: any, res: any) => {
      try {
        res.json(await currentAffairsLearningService.list(2000));
      } catch (err) {
        console.error('[current-affairs] admin list failed', err);
        res.status(500).json({ error: 'Failed to load current affairs' });
      }
    },
  ).post(
    requireStaffAuth,
    requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'),
    async (req: any, res: any) => {
      try {
        res.json(await currentAffairsLearningService.create(req.body));
      } catch (err: any) {
        res.status(400).json({ error: err.message ?? 'Failed to create current affairs' });
      }
    },
  );

  app.route('/admin/current-affairs-learning/generate').post(
    requireStaffAuth,
    requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'),
    async (_req: any, res: any) => {
      try {
        res.json(await currentAffairsLearningService.generateDaily());
      } catch (err: any) {
        console.error('[current-affairs] AI generation failed', err);
        res.status(500).json({ error: err.message ?? 'Failed to generate current affairs' });
      }
    },
  );

  app.route('/admin/current-affairs-learning/:id').delete(
    requireStaffAuth,
    requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'),
    async (req: any, res: any) => {
      try {
        await currentAffairsLearningService.delete(req.params.id);
        res.json({ deleted: true });
      } catch (err: any) {
        res.status(400).json({ error: err.message ?? 'Failed to delete current affairs' });
      }
    },
  );
}

// Hook the first route registration performed by server.ts and install our
// routes on that exact Express application instance.
const originalGet: any = express.application.get;
(express.application as any).get = function patchedGet(this: any, ...args: any[]) {
  install(this);
  return originalGet.apply(this, args);
};

// Automatic daily generation. The service refuses to create a day when it
// cannot find enough genuinely new, verified events, so there is no filler.
cron.schedule('15 6 * * *', async () => {
  try {
    const result = await currentAffairsLearningService.generateDaily();
    console.log('[cron] Current Affairs learning:', result);
  } catch (err) {
    console.error('[cron] Current Affairs learning generation failed', err);
  }
}, { timezone: 'Asia/Kolkata' });
