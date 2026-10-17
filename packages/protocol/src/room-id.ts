/** Room ids: 10 chars of Crockford Base32 (50 bits). 256 % 32 === 0, so `b & 31` is exactly uniform. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RE_ROOM_ID = /^[0-9A-HJKMNP-TV-Z]{10}$/;

export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let out = '';
  for (const b of bytes) out += ALPHABET[b & 31];
  return out;
}
