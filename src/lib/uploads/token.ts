// Upload-link tokens. The driver's link carries a random token; the database
// stores only its SHA-256 hash, so a leaked database can't be used to upload.

import { createHash, randomBytes } from 'node:crypto';

export const LINK_DAYS = 7;

/** A new random token: 32 bytes, URL-safe (43 characters). */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Rejects anything that isn't shaped like one of our tokens before touching the database. */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type LinkState = 'ok' | 'expired' | 'used';

export function linkState(link: { expires_at: string; used_at: string | null }, now: Date): LinkState {
  if (link.used_at) return 'used';
  if (new Date(link.expires_at) <= now) return 'expired';
  return 'ok';
}
