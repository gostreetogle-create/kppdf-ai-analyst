import express, { Request, Response, NextFunction } from 'express';
import healthRoutes from './routes/health.routes';
import syncRoutes from './routes/sync.routes';
import newsRoutes from './routes/news.routes';
import runsRoutes from './routes/runs.routes';
import adminRoutes from './routes/admin/admin.routes';
import { apiKeyAuth } from './middleware/api-key.middleware';
import { mountAdminSpa } from './utils/admin-static';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  if (process.env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
      console.log(`  ${req.method} ${req.path}`);
      next();
    });
  }

  // Admin API (JWT) — before SPA static
  app.use('/admin', adminRoutes);

  // Public health — no API key
  app.use('/v1', healthRoutes);

  // Protected /v1/*
  app.use('/v1', apiKeyAuth);
  app.use('/v1', syncRoutes);
  app.use('/v1/news', newsRoutes);
  app.use('/v1', runsRoutes);

  mountAdminSpa(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[error]', err);
    res.status(500).json({ error: message });
  });

  return app;
}
