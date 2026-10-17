/**
 * Room ID generation
 * Uses Web Crypto API for cryptographically secure random bytes
 */

const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'; // base32 without ambiguous chars
const ID_LENGTH = 12; // 12 chars = ~60 bits entropy

/**
 * Generate a new room ID
 * Format: 12-char base32 string (e.g. "x7k3m9pq2wfn")
 */
export function newRoomId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  
  let result = '';
  for (let i = 0; i < ID_LENGTH; i++) {
    result += ALPHABET[bytes[i] % ALPHABET.length];
  }
  
  return result;
}

/**
 * Validate room ID format
 */
export function isValidRoomId(id: string): boolean {
  if (id.length !== ID_LENGTH) return false;
  for (let i = 0; i < id.length; i++) {
    if (!ALPHABET.includes(id[i])) return false;
  }
  return true;
}
