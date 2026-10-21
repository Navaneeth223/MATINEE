import { toB64u, fromB64u } from './seal';

export function buildInviteLink(origin: string, roomId: string, secret: Uint8Array): string {
  if (secret.length !== 16) {
    throw new Error('Secret must be exactly 16 bytes');
  }
  const secretB64 = toB64u(secret);
  return `${origin}/r/${roomId}#k=${secretB64}`;
}

export function parseInviteFragment(fragment: string): Uint8Array | null {
  const match = fragment.match(/k=([A-Za-z0-9_-]+)/);
  if (!match || !match[1]) return null;
  
  const secretB64 = match[1];
  try {
    const secret = fromB64u(secretB64);
    if (secret.length !== 16) return null;
    return secret;
  } catch {
    return null;
  }
}
