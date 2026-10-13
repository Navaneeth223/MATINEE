import { describe, it, expect } from 'vitest';

import {
  Session, deriveRoomKeys, hashJoinToken, newPeerId, newRoomSecret, toB64u, fromB64u, type Envelope,
} from './seal';

const ROOM = 'K7M2QX9TD4';

async function pair(secret = newRoomSecret(), roomId = ROOM) {
  const { kEnc } = await deriveRoomKeys(secret, roomId);
  const a = new Session(kEnc, newPeerId());
  const b = new Session(kEnc, newPeerId());
  return { a, b, secret };
}

describe('seal/open round trip', () => {
  it('delivers the payload and header intact', async () => {
    const { a, b } = await pair();
    const env = await a.seal('chat', { text: 'hello 🎬 മലയാളം ไทย' });
    const out = await b.open(env);
    expect(out.payload).toEqual({ text: 'hello 🎬 മലയാളം ไทย' });
    expect(out.t).toBe('chat');
    expect(out.from).toBe(a.selfId);
  });

  it('handles a 200 KB payload (no stack overflow in base64)', async () => {
    const { a, b } = await pair();
    const big = 'x'.repeat(200_000);
    const out = await b.open(await a.seal('blob', { big }));
    expect((out.payload as { big: string }).big.length).toBe(200_000);
  });

  it('base64url helper round-trips random bytes of many lengths', () => {
    for (let n = 0; n < 70; n++) {
      const bytes = crypto.getRandomValues(new Uint8Array(n));
      expect(Array.from(fromB64u(toB64u(bytes)))).toEqual(Array.from(bytes));
    }
  });
});

describe('tamper detection', () => {
  it('rejects a changed ciphertext byte', async () => {
    const { a, b } = await pair();
    const env = await a.seal('chat', { n: 1 });
    const bytes = fromB64u(env.ct);
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await expect(b.open({ ...env, ct: toB64u(bytes) })).rejects.toThrow();
  });

  it.each([
    ['t', (e: Envelope) => ({ ...e, t: 'cmd' })],
    ['from', (e: Envelope) => ({ ...e, from: 'ffffffffffffffff' })],
    ['to', (e: Envelope) => ({ ...e, to: 'eeeeeeeeeeeeeeee' })],
  ])('rejects a changed header field: %s', async (_name, mutate) => {
    const { a, b } = await pair();
    const env = await a.seal('chat', { n: 1 });
    await expect(b.open(mutate(env))).rejects.toThrow();
  });

  it('rejects a changed seq or sid (also breaks the nonce check)', async () => {
    const { a, b } = await pair();
    const env = await a.seal('chat', { n: 1 });
    await expect(b.open({ ...env, seq: env.seq + 1 })).rejects.toThrow();
    await expect(b.open({ ...env, sid: '00000000' })).rejects.toThrow();
  });

  it('rejects malformed envelopes', async () => {
    const { b } = await pair();
    await expect(b.open({} as Envelope)).rejects.toThrow();
    await expect(b.open({ v: 2 } as unknown as Envelope)).rejects.toThrow();
  });
});

describe('wrong key / wrong room', () => {
  it('rejects a message sealed with a different room secret', async () => {
    const { a } = await pair();
    const { b: outsider } = await pair();
    await expect(outsider.open(await a.seal('chat', { n: 1 }))).rejects.toThrow();
  });

  it('same secret but a different room id derives a different key', async () => {
    const secret = newRoomSecret();
    const { a } = await pair(secret, 'ROOMAAAAAA');
    const { b } = await pair(secret, 'ROOMBBBBBB');
    await expect(b.open(await a.seal('chat', { n: 1 }))).rejects.toThrow();
  });
});

describe('replay protection', () => {
  it('rejects the same envelope twice', async () => {
    const { a, b } = await pair();
    const env = await a.seal('chat', { n: 1 });
    await b.open(env);
    await expect(b.open(env)).rejects.toThrow('replay');
  });

  it('rejects an older message after a newer one', async () => {
    const { a, b } = await pair();
    const first = await a.seal('chat', { n: 1 });
    const second = await a.seal('chat', { n: 2 });
    await b.open(second);
    await expect(b.open(first)).rejects.toThrow('replay');
  });

  it('rejects two copies arriving at the same moment (race)', async () => {
    const { a, b } = await pair();
    const env = await a.seal('chat', { n: 1 });
    const results = await Promise.allSettled([b.open(env), b.open(env)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('accepts a reconnected peer (new Session = new sid, counter restarts at 0)', async () => {
    const secret = newRoomSecret();
    const { kEnc } = await deriveRoomKeys(secret, ROOM);
    const id = newPeerId();
    const receiver = new Session(kEnc, newPeerId());

    const s1 = new Session(kEnc, id);
    await receiver.open(await s1.seal('chat', { n: 1 }));
    await receiver.open(await s1.seal('chat', { n: 2 }));

    const s2 = new Session(kEnc, id); // same peer reconnects
    const env = await s2.seal('chat', { n: 3 });
    expect(env.seq).toBe(0);
    await expect(receiver.open(env)).resolves.toBeTruthy();
  });

  it('garbage with a huge seq does not poison the counter', async () => {
    const { a, b } = await pair();
    const good = await a.seal('chat', { n: 1 });
    await expect(b.open({ ...good, seq: 9_000_000 })).rejects.toThrow();
    await expect(b.open(good)).resolves.toBeTruthy();
  });
});

describe('nonce uniqueness', () => {
  it('50,000 seals produce 50,000 distinct nonces', async () => {
    const { a } = await pair();
    const seen = new Set<string>();
    for (let i = 0; i < 50_000; i++) seen.add((await a.seal('chat', i)).iv);
    expect(seen.size).toBe(50_000);
  });

  it('concurrent seal() calls never share a seq', async () => {
    const { a } = await pair();
    const envs = await Promise.all(Array.from({ length: 500 }, (_, i) => a.seal('chat', i)));
    expect(new Set(envs.map((e) => e.seq)).size).toBe(500);
  });
});

describe('join token (server-checkable, secret never sent)', () => {
  it('is deterministic for the same secret + room, different otherwise', async () => {
    const secret = newRoomSecret();
    const x = await deriveRoomKeys(secret, 'ROOMAAAAAA');
    const y = await deriveRoomKeys(secret, 'ROOMAAAAAA');
    const z = await deriveRoomKeys(secret, 'ROOMBBBBBB');
    const w = await deriveRoomKeys(newRoomSecret(), 'ROOMAAAAAA');

    expect(x.joinToken).toBe(y.joinToken);
    expect(x.joinToken).not.toBe(z.joinToken);
    expect(x.joinToken).not.toBe(w.joinToken);
  });

  it('server-side hash matches only the right token and does not reveal it', async () => {
    const { joinToken } = await deriveRoomKeys(newRoomSecret(), ROOM);
    const stored = await hashJoinToken(joinToken);

    expect(await hashJoinToken(joinToken)).toBe(stored);
    expect(stored).not.toContain(joinToken);
    expect(await hashJoinToken(joinToken + 'x')).not.toBe(stored);
  });

  it('rejects a secret shorter than 16 bytes', async () => {
    await expect(deriveRoomKeys(new Uint8Array(8), ROOM)).rejects.toThrow();
  });
});
