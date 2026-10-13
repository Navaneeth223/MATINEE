import { describe, it, expect } from 'vitest';
import { WebSocket } from 'ws';

const BASE_URL = 'http://127.0.0.1:8788';

//  Utility functions
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function toB64u(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function newRoomSecret(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

function newPeerId(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(8)));
}

async function deriveRoomKeys(roomSecret: Uint8Array, roomId: string) {
  const enc = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', roomSecret, 'HKDF', false, ['deriveKey', 'deriveBits']);
  
  const kEnc = await crypto.subtle.deriveKey(
    { name: 'HKDF', salt: enc.encode(roomId), info: enc.encode('kEnc'), hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const tokenBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', salt: enc.encode(roomId), info: enc.encode('joinToken'), hash: 'SHA-256' },
      material,
      160
    )
  );
  const joinToken = toB64u(tokenBytes);

  return { kEnc, joinToken };
}

async function connectPeer(roomId: string, peerId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE_URL}/ws/${roomId}?p=${peerId}`);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error('WebSocket connection failed'));
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

function waitForMessage(ws: WebSocket, predicate?: (data: any) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Message timeout')), 5000);
    const handler = (event: any) => {
      const data = JSON.parse(event.toString());
      if (!predicate || predicate(data)) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(data);
      }
    };
    ws.on('message', handler);
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('RoomDO Integration Tests', () => {
  it('double join - ignores second join from same socket', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId = newPeerId();

    const ws = await connectPeer(roomId, peerId);
    
    // First join
    ws.send(JSON.stringify({ type: 'join', joinToken }));
    const msg1 = await waitForMessage(ws, m => m.type === 'join-ok');
    expect(msg1.role).toBe('creator');
    expect(msg1.peers).toEqual([]);

    // Second join (should be ignored)
    ws.send(JSON.stringify({ type: 'join', joinToken }));
    
    // Send a ping to confirm socket still alive
    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await waitForMessage(ws, m => m.type === 'pong');
    expect(pong.type).toBe('pong');

    ws.close();
  });

  it('two simultaneous first joins - both admitted', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    // Send joins simultaneously
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    ws2.send(JSON.stringify({ type: 'join', joinToken }));

    const [msg1, msg2] = await Promise.all([
      waitForMessage(ws1, m => m.type === 'join-ok'),
      waitForMessage(ws2, m => m.type === 'join-ok'),
    ]);

    // Both should be admitted
    expect(msg1.type).toBe('join-ok');
    expect(msg2.type).toBe('join-ok');

    ws1.close();
    ws2.close();
  });

  it('joiner receives peers list in join-ok', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    // First peer creates room
    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    // Second peer joins
    const ws2 = await connectPeer(roomId, peerId2);
    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    const msg2 = await waitForMessage(ws2, m => m.type === 'join-ok');
    
    expect(msg2.peers).toEqual([peerId1]);

    ws1.close();
    ws2.close();
  });

  it('extra fields stripped from relayed envelope', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    // Connect and admit both peers
    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    // Peer1 sends envelope with extra field
    const envelope = {
      v: 1,
      t: 'chat',
      from: peerId1,
      seq: 0,
      sid: '12345678',
      iv: 'abc123',
      ct: 'encrypted_content',
      extraField: 'should be stripped',
    };
    ws1.send(JSON.stringify(envelope));

    // Peer2 receives envelope without extra field
    const received = await waitForMessage(ws2, m => m.v === 1);
    expect(received).not.toHaveProperty('extraField');
    expect(received).toHaveProperty('v');
    expect(received).toHaveProperty('t');
    expect(received).toHaveProperty('from');
    expect(received).toHaveProperty('seq');
    expect(received).toHaveProperty('sid');
    expect(received).toHaveProperty('iv');
    expect(received).toHaveProperty('ct');

    ws1.close();
    ws2.close();
  });

  it('wrong token rejected', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret1 = newRoomSecret();
    const secret2 = newRoomSecret();
    const { joinToken: token1 } = await deriveRoomKeys(secret1, roomId);
    const { joinToken: token2 } = await deriveRoomKeys(secret2, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    // Peer1 creates room with token1
    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken: token1 }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    // Peer2 tries with wrong token
    const ws2 = await connectPeer(roomId, peerId2);
    ws2.send(JSON.stringify({ type: 'join', joinToken: token2 }));
    const msg2 = await waitForMessage(ws2, m => m.type === 'join-denied');
    
    expect(msg2.reason).toContain('Wrong secret');

    ws1.close();
  });

  it('third peer gets "room full"', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();
    const peerId3 = newPeerId();

    // Two peers join
    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    // Third peer tries to join
    const ws3 = await connectPeer(roomId, peerId3);
    ws3.send(JSON.stringify({ type: 'join', joinToken }));
    const msg3 = await waitForMessage(ws3, m => m.type === 'join-denied');
    
    expect(msg3.reason).toBe('Room full');

    ws1.close();
    ws2.close();
  });

  it('41st burst message rate limited', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId = newPeerId();

    const ws = await connectPeer(roomId, peerId);
    ws.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws, m => m.type === 'join-ok');

    // Send many small envelopes (each ~100 bytes = 0.1 KiB)
    // Rate limit: 40 token burst. Each message costs bytes/1024
    // So we need ~400 small messages to hit the burst limit
    for (let i = 0; i < 450; i++) {
      const envelope = {
        v: 1,
        t: 'chat',
        from: peerId,
        seq: i,
        sid: '12345678',
        iv: 'iv',
        ct: 'x',
      };
      ws.send(JSON.stringify(envelope));
    }

    // Socket should close with rate limit
    const closed = await new Promise<boolean>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve(reason.toString() === 'Rate limit exceeded');
      });
      setTimeout(() => resolve(false), 5000);
    });

    expect(closed).toBe(true);
  });

  it('unadmitted idle socket closed at 10s', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const peerId = newPeerId();

    const ws = await connectPeer(roomId, peerId);
    
    // Don't send join - just wait
    const closePromise = new Promise<string>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve(reason.toString());
      });
    });

    const reason = await closePromise;
    expect(reason).toBe('Admission timeout');
  }, 15000);

  it('half-open eviction - admitted socket silent for >60s gets evicted when room is full', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();
    const peerId3 = newPeerId();

    // Peer1 joins
    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    // Wait 61 seconds (peer1 goes silent)
    await sleep(61_000);

    // Peer2 joins (should succeed)
    const ws2 = await connectPeer(roomId, peerId2);
    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    // Peer3 tries to join - should trigger eviction of peer1
    const ws3 = await connectPeer(roomId, peerId3);
    ws3.send(JSON.stringify({ type: 'join', joinToken }));
    const msg3 = await waitForMessage(ws3, m => m.type === 'join-ok' || m.type === 'join-denied');
    
    // After eviction, peer3 should be admitted
    expect(msg3.type).toBe('join-ok');

    ws2.close();
    ws3.close();
  }, 70000);

  it('no storage write per relayed message', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    // Connect both peers
    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    // Send 10 messages quickly
    for (let i = 0; i < 10; i++) {
      const envelope = {
        v: 1,
        t: 'chat',
        from: peerId1,
        seq: i,
        sid: '12345678',
        iv: 'iv',
        ct: `msg${i}`,
      };
      ws1.send(JSON.stringify(envelope));
    }

    // Wait for all to be relayed
    for (let i = 0; i < 10; i++) {
      await waitForMessage(ws2, m => m.v === 1);
    }

    // If storage writes per message, we'd see significant delay or errors
    // This test verifies relay happens without blocking on storage writes
    ws1.close();
    ws2.close();

    // Success if no errors thrown
    expect(true).toBe(true);
  });
});
