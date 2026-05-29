import express, { Express, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

export function mountAdminSpa(app: Express): void {
  const adminDist = path.resolve(__dirname, '../../../admin/dist');
  if (!fs.existsSync(path.join(adminDist, 'index.html'))) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[admin] admin/dist not found — build admin for /admin UI');
    }
    return;
  }

  app.use('/admin', express.static(adminDist, { index: 'index.html' }));
  app.get('/admin/*', (req: Request, res: Response) => {
    res.sendFile(path.join(adminDist, 'index.html'));
  });
  console.log('[admin] serving SPA from', adminDist);
}
