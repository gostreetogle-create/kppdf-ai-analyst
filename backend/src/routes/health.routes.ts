import { Router } from 'express';
import { isMongoReady } from '../clients/mongo.client';
import { qdrantHealth } from '../clients/qdrant.client';

const router = Router();

router.get('/health', async (_req, res) => {
  const mongo = isMongoReady();
  const qdrant = await qdrantHealth();
  res.json({
    status: mongo && qdrant ? 'ok' : 'degraded',
    mongo: mongo ? 'ok' : 'down',
    qdrant: qdrant ? 'ok' : 'down',
    timestamp: new Date().toISOString(),
  });
});

export default router;
