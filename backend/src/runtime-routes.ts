// Additive Current Affairs learning routes. Preloaded by backend dev/start so
// the large server.ts stays untouched while this feature gets its own routes.
import express from 'express';
import cron from 'node-cron';
import { requireStaffAuth, requireRole } from './modules/admin/staff-auth.service';
import { currentAffairsLearningService } from './modules/admin/current-affairs-learning.service';

let installed = false;
const originalGet = express.application.get;
const originalPost = express.application.post;
const originalDelete = express.application.delete;

function install(app: any) {
  if (installed) return;
  installed = true;

  originalGet.call(app, '/current-affairs', async (req: any, res: any) => {
    try {
      const limit = Number(req.query.limit) || 1200;
      res.json(await currentAffairsLearningService.list(limit));
    } catch (err) {
      console.error('[current-affairs] list failed', err);
      res.status(500).json({ error: 'Failed to load current affairs' });
    }
  });

  originalGet.call(app, '/admin/current-affairs-learning', requireStaffAuth, async (_req: any, res: any) => {
    try {
      res.json(await currentAffairsLearningService.list(2000));
    } catch (err) {
      console.error('[current-affairs] admin list failed', err);
      res.status(500).json({ error: 'Failed to load current affairs' });
    }
  });

  originalPost.call(app, '/admin/current-affairs-learning/generate', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (_req: any, res: any) => {
    try {
      res.json(await currentAffairsLearningService.generateDaily());
    } catch (err: any) {
      console.error('[current-affairs] AI generation failed', err);
      res.status(500).json({ error: err.message ?? 'Failed to generate current affairs' });
    }
  });

  originalPost.call(app, '/admin/current-affairs-learning', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req: any, res: any) => {
    try {
      res.json(await currentAffairsLearningService.create(req.body));
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? 'Failed to create current affairs' });
    }
  });

  originalDelete.call(app, '/admin/current-affairs-learning/:id', requireStaffAuth, requireRole('SUPER_ADMIN', 'CONTENT_ADMIN'), async (req: any, res: any) => {
    try {
      await currentAffairsLearningService.delete(req.params.id);
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? 'Failed to delete current affairs' });
    }
  });
}

// Hook the first route registration performed by server.ts and install our
// routes on that exact Express application instance.
(express.application as any).get = function patchedGet(this: any, ...args: any[]) {
  install(this);
  return originalGet.apply(this, args as any);
};
(express.application as any).post = function patchedPost(this: any, ...args: any[]) {
  install(this);
  return originalPost.apply(this, args as any);
};
(express.application as any).delete = function patchedDelete(this: any, ...args: any[]) {
  install(this);
  return originalDelete.apply(this, args as any);
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
