import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.header('X-API-Key');
  if (key !== config.apiKey) {
    res.status(401).json({ error: 'Invalid or missing X-API-Key' });
    return;
  }
  next();
}
