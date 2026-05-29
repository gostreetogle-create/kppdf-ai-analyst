import { Router } from 'express';
import { AgentRunModel } from '../models/agentRun.model';

const router = Router();

router.get('/runs', async (_req, res) => {
  const runs = await AgentRunModel.find().sort({ startedAt: -1 }).limit(50);
  res.json({ data: runs });
});

export default router;
