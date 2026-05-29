import { config } from './config';
import { connectMongo } from './clients/mongo.client';
import { initKppdfSession } from './clients/kppdf.client';
import { ensureCollection } from './clients/qdrant.client';
import { createApp } from './app';
import { startScheduler } from './jobs/scheduler';

async function bootstrap() {
  await connectMongo(config.mongoUri);

  try {
    await ensureCollection();
  } catch (err) {
    console.warn('[qdrant] init skipped:', err instanceof Error ? err.message : err);
  }

  try {
    await initKppdfSession();
  } catch (err) {
    console.warn('[kppdf] init skipped:', err instanceof Error ? err.message : err);
  }

  startScheduler();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
    console.log(`[server] env: ${config.nodeEnv}`);
  });
}

bootstrap().catch((err) => {
  console.error('[bootstrap] failed', err);
  process.exit(1);
});
