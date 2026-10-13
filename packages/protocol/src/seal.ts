/**
 * Matinee sealed messages — SPEC §11.1 / §11.3, "room-key" variant.
 *
 * What this gives you (v1):
 *  - Every message is AES-GCM-256 encrypted with a key derived from the room secret
 *    (the secret lives only in the URL #fragment; the server never sees it).
 *  - The envelope header (v, t, from, to, seq, sid) is bound into the AAD, so changing
 *    ANY header field makes decryption fail.
 *  - Nonce = sid (4 random bytes per session) || seq (uint64, big-endian). Never reused.
 *  - Replay protection per (from, sid): seq must strictly increase.
 *  - A server-checkable join token (derived from the secret) so strangers who only know
 *    the room id cannot take a seat. The server stores only SHA-256(joinToken).
 *
 * Not included on purpose (SPEC marks them "Should", planned for M11 hardening):
 *  per-session ECDH forward secrecy, SAS words, knock/approve.
 *
 * Pure WebCrypto: works in browsers, Node 20+, and Cloudflare Workers. No DOM access.
 */

export interface Envelope {
  v: 1;
  t: string; // message type (server-visible)
  from: string; // sender peerId: 16 lowercase hex chars
  to?: string; // receiver peerId; omitted = the other peer
  seq: number; // per-sender counter within a session
  sid: string; // 8 lowercase hex chars (4 random bytes), new per session
  iv: string; // base64url of 12 bytes = sid || seq(uint64 BE)
  ct: string; // base64url of AES-GCM ciphertext || 16-byte tag
}

export interface Opened {
  t: string;
  from: string;
  to?: string;
  seq: number;
  payload: unknown;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const RE_TYPE = /^[a-z0-9._-]{1,32}$/;
const RE_PEER = /^[0-9a-f]{16}$/;
const RE_SID = /^[0-9a-f]{8}$/;

const MAX_CT_CHARS = 1_400_000; // ~1 MiB of ciphertext; callers chunk bigger data (§8.7.3)

/* ---------- small helpers (no spread of big arrays, so large payloads are safe) ---------- */

export function toB64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64u(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('bad base64url');
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

function fromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function newPeerId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(8)));
}

export function newRoomSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/* ---------- key derivation ---------- */

export async function deriveRoomKeys(
  roomSecret: Uint8Array,
  roomId: string,
): Promise<{ kEnc: CryptoKey; joinToken: string }> {
  if (roomSecret.length < 16) throw new Error('roomSecret must be at least 16 bytes');

  const base = await crypto.subtle.importKey('raw', roomSecret as BufferSource, 'HKDF', false, [
    'deriveKey',
    'deriveBits',
  ]);

  const salt = enc.encode(roomId);

  const kEnc = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('matinee/v1/enc') },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );

  const joinBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('matinee/v1/join') },
    base,
    256,
  );

  return { kEnc, joinToken: toB64u(new Uint8Array(joinBits)) };
}

/** What the server stores for the room. It cannot recover the join token or the secret from this. */
export async function hashJoinToken(joinToken: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(joinToken));
  return toB64u(new Uint8Array(digest));
}

/* ---------- header checks, AAD, nonce ---------- */

function checkHeader(h: { t: string; from: string; to?: string | undefined; sid: string; seq: number }): void {
  if (!RE_TYPE.test(h.t)) throw new Error('bad type');
  if (!RE_PEER.test(h.from)) throw new Error('bad from');
  if (h.to !== undefined && !RE_PEER.test(h.to)) throw new Error('bad to');
  if (!RE_SID.test(h.sid)) throw new Error('bad sid');
  if (!Number.isSafeInteger(h.seq) || h.seq < 0) throw new Error('bad seq');
}

function aadFor(h: { t: string; from: string; to?: string | undefined; seq: number; sid: string }): Uint8Array {
  return enc.encode(`v1|${h.t}|${h.from}|${h.to ?? '*'}|${h.seq}|${h.sid}`);
}

function nonceFor(sidBytes: Uint8Array, seq: number): Uint8Array {
  const n = new Uint8Array(12);
  n.set(sidBytes, 0);
  new DataView(n.buffer).setBigUint64(4, BigInt(seq), false);
  return n;
}

/* ---------- the session: one per connection (a reconnect creates a NEW Session) ---------- */

export class Session {
  readonly sid: string;
  private readonly sidBytes: Uint8Array;
  private seq = 0;
  private readonly lastSeen = new Map<string, number>();

  constructor(
    private readonly kEnc: CryptoKey,
    readonly selfId: string,
  ) {
    if (!RE_PEER.test(selfId)) throw new Error('bad selfId');
    this.sidBytes = crypto.getRandomValues(new Uint8Array(4));
    this.sid = toHex(this.sidBytes);
  }

  async seal(t: string, payload: unknown, to?: string): Promise<Envelope> {
    const seq = this.seq++; // synchronous: concurrent seal() calls can never share a seq
    const header = { t, from: this.selfId, to, seq, sid: this.sid };
    checkHeader(header);

    const iv = nonceFor(this.sidBytes, seq);

    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aadFor(header) as BufferSource, tagLength: 128 },
      this.kEnc,
      enc.encode(JSON.stringify(payload ?? null)) as BufferSource,
    );

    const env: Envelope = { v: 1, t, from: this.selfId, seq, sid: this.sid, iv: toB64u(iv), ct: toB64u(new Uint8Array(ct)) };
    if (to !== undefined) env.to = to;
    return env;
  }

  /** Throws on: bad shape, wrong key, any tampered field, replay, wrong nonce. */
  async open(env: Envelope): Promise<Opened> {
    if (!env || env.v !== 1 || typeof env.iv !== 'string' || typeof env.ct !== 'string') {
      throw new Error('bad envelope');
    }
    if (env.ct.length > MAX_CT_CHARS) throw new Error('envelope too large');

    checkHeader(env);

    const sidBytes = fromHex(env.sid);
    const iv = fromB64u(env.iv);
    const expected = nonceFor(sidBytes, env.seq);
    if (iv.length !== 12 || iv.some((b, i) => b !== expected[i])) throw new Error('nonce mismatch');

    const key = `${env.from}:${env.sid}`;
    const early = this.lastSeen.get(key);
    if (early !== undefined && env.seq <= early) throw new Error('replay');

    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aadFor(env) as BufferSource, tagLength: 128 },
      this.kEnc,
      fromB64u(env.ct) as BufferSource,
    ); // throws if the key is wrong or anything was changed

    // Re-check and record with no await in between, so two copies of one envelope
    // arriving together cannot both pass. We record only AFTER successful decryption,
    // so garbage with a huge seq cannot poison the counter.
    const again = this.lastSeen.get(key);
    if (again !== undefined && env.seq <= again) throw new Error('replay');
    this.lastSeen.set(key, env.seq);

    const out: Opened = { t: env.t, from: env.from, seq: env.seq, payload: JSON.parse(dec.decode(pt)) };
    if (env.to !== undefined) out.to = env.to;
    return out;
  }
}
