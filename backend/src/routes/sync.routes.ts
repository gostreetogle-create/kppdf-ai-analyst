import { Router } from 'express';
import { AgentRunModel } from '../models/agentRun.model';
import { syncCatalog } from '../modules/knowledge/indexer.service';

const router = Router();

router.post('/sync', async (_req, res, next) => {
  const run = await AgentRunModel.create({
    type: 'sync',
    status: 'running',
    startedAt: new Date(),
    stats: { trigger: 'manual' },
  });

  try {
    const stats = await syncCatalog();
    run.status = 'success';
    run.finishedAt = new Date();
    run.stats = { ...stats, trigger: 'manual' };
    await run.save();

    res.json({
      ok: true,
      agentRunId: run._id,
      ...stats,
    });
  } catch (err) {
    run.status = 'failed';
    run.finishedAt = new Date();
    run.error = err instanceof Error ? err.message : String(err);
    await run.save();
    next(err);
  }
});

export default router;
