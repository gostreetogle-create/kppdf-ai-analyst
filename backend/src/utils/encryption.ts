import crypto from 'crypto';
import { config } from '../config';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(plain: string): string {
  const secret = config.admin.encryptionSecret;
  if (!secret || secret.length < 16) {
    throw new Error('[crypto] ADMIN_ENCRYPTION_SECRET must be at least 16 characters');
  }
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key.subarray(0, KEY_LEN), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const secret = config.admin.encryptionSecret;
  if (!secret || secret.length < 16) {
    throw new Error('[crypto] ADMIN_ENCRYPTION_SECRET must be at least 16 characters');
  }
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error('[crypto] invalid encrypted payload');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const key = deriveKey(secret);
  const decipher = crypto.createDecipheriv(ALGO, key.subarray(0, KEY_LEN), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  const tail = key.length >= 4 ? key.slice(-4) : '****';
  if (key.startsWith('sk-')) return `sk-...${tail}`;
  return `...${tail}`;
}
