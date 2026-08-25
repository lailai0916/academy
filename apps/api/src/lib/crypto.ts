import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../config.js';

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function createInviteCode() {
  const raw = randomBytes(9).toString('base64url').toUpperCase();
  return `ACA-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

function encryptionKey() {
  return createHash('sha256').update(config.AI_CONFIG_ENCRYPTION_KEY).digest();
}

export function encryptSecret(value: string) {
  if (!value) {
    return '';
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export function decryptSecret(value: string) {
  if (!value) {
    return '';
  }
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.split('.');
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error('Stored secret has an invalid format.');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivEncoded, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
