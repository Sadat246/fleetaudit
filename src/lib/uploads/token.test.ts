import { describe, expect, it } from 'vitest';
import { hashToken, linkState, looksLikeToken, newToken } from './token';

describe('upload link tokens', () => {
  it('makes a different, URL-safe token every time', () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(looksLikeToken(a)).toBe(true);
  });

  it('hashes the same token the same way, and never returns the token itself', () => {
    const t = newToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toContain(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects junk before it reaches the database', () => {
    expect(looksLikeToken('')).toBe(false);
    expect(looksLikeToken('../../etc/passwd')).toBe(false);
    expect(looksLikeToken(newToken() + 'x')).toBe(false);
  });
});

describe('linkState', () => {
  const now = new Date('2026-11-24T12:00:00Z');

  it('a fresh link works', () => {
    expect(linkState({ expires_at: '2026-12-01T12:00:00Z', used_at: null }, now)).toBe('ok');
  });
  it('an expired link does not', () => {
    expect(linkState({ expires_at: '2026-11-24T12:00:00Z', used_at: null }, now)).toBe('expired');
  });
  it('a used link does not, even if not expired', () => {
    expect(linkState({ expires_at: '2026-12-01T12:00:00Z', used_at: '2026-11-24T11:00:00Z' }, now)).toBe('used');
  });
});
