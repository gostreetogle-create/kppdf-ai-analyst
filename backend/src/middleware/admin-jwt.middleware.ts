import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { verifyAdminJwt } from '../utils/jwt';

export interface AdminAuthRequest extends Request {
  adminUser?: string;
}

export function adminJwtAuth(req: AdminAuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Требуется авторизация' });
    return;
  }

  const token = header.slice(7);
  const payload = verifyAdminJwt(token, config.admin.jwtSecret);
  if (!payload) {
    res.status(401).json({ error: 'Недействительный или просроченный токен' });
    return;
  }

  req.adminUser = payload.sub;
  next();
}
