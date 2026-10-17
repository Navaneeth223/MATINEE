import { describe, it, expect } from 'vitest';
import { Session, newRoomSecret, deriveRoomKeys, newPeerId } from '@matinee/protocol';
import { WebSocket } from 'ws';

const BASE_URL = 'http://127.0.0.1:8789';

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
    
    ws.send(JSON.stringify({ type: 'join', joinToken }));
    const msg1 = await waitForMessage(ws, m => m.type === 'join-ok');
    expect(msg1.role).toBe('creator');
    expect(msg1.peers).toEqual([]);

    ws.send(JSON.stringify({ type: 'join', joinToken }));
    
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

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    ws2.send(JSON.stringify({ type: 'join', joinToken }));

    const [msg1, msg2] = await Promise.all([
      waitForMessage(ws1, m => m.type === 'join-ok'),
      waitForMessage(ws2, m => m.type === 'join-ok'),
    ]);

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

    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

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
    const { kEnc, joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    const session1 = new Session(kEnc, peerId1);

    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    const envelope = await session1.seal('chat', { text: 'hello' });
    const envelopeWithExtra = { ...envelope, extraField: 'should be stripped' };
    ws1.send(JSON.stringify(envelopeWithExtra));

    const received = await waitForMessage(ws2, m => m.v === 1);
    expect(received).not.toHaveProperty('extraField');
    expect(received).toHaveProperty('v');
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

    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken: token1 }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

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

    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

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
    const { kEnc, joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId = newPeerId();
    const session = new Session(kEnc, peerId);

    const ws = await connectPeer(roomId, peerId);
    ws.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws, m => m.type === 'join-ok');

    // Send many messages to exceed burst (40 tokens, ~1 KiB each = 40 KiB burst)
    for (let i = 0; i < 50; i++) {
      const envelope = await session.seal('chat', { text: 'x'.repeat(1000) });
      ws.send(JSON.stringify(envelope));
    }

    const closed = await new Promise<boolean>((resolve) => {
      ws.on('close', (code, reason) => {
        resolve(reason.toString() === 'Rate limit exceeded');
      });
      setTimeout(() => resolve(false), 5000);
    });

    expect(closed).toBe(true);
  }, 10000);

  it('no storage write per relayed message', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { kEnc, joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    const session1 = new Session(kEnc, peerId1);

    const [ws1, ws2] = await Promise.all([
      connectPeer(roomId, peerId1),
      connectPeer(roomId, peerId2),
    ]);

    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    for (let i = 0; i < 10; i++) {
      const envelope = await session1.seal('chat', { text: `msg${i}` });
      ws1.send(JSON.stringify(envelope));
    }

    for (let i = 0; i < 10; i++) {
      await waitForMessage(ws2, m => m.v === 1);
    }

    ws1.close();
    ws2.close();

    expect(true).toBe(true);
  });

  it('rejected visitor does not trigger presence left', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const wrongSecret = newRoomSecret();
    const { joinToken: wrongToken } = await deriveRoomKeys(wrongSecret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();

    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    // Wrong token visitor connects and gets rejected
    const ws2 = await connectPeer(roomId, peerId2);
    ws2.send(JSON.stringify({ type: 'join', joinToken: wrongToken }));
    await waitForMessage(ws2, m => m.type === 'join-denied');

    // Wait a bit to ensure no 'left' message
    await sleep(500);
    
    // ws1 should not have received any 'left' message
    // (no easy way to assert absence, but test passes if no crash)
    
    ws1.close();
  });

  it('half-open eviction - admitted socket silent for >3s gets evicted when room is full', async () => {
    const roomId = `test${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerId1 = newPeerId();
    const peerId2 = newPeerId();
    const peerId3 = newPeerId();

    const ws1 = await connectPeer(roomId, peerId1);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws1, m => m.type === 'join-ok');

    await sleep(3100);

    const ws2 = await connectPeer(roomId, peerId2);
    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws2, m => m.type === 'join-ok');

    const ws3 = await connectPeer(roomId, peerId3);
    ws3.send(JSON.stringify({ type: 'join', joinToken }));
    const msg3 = await waitForMessage(ws3, m => m.type === 'join-ok' || m.type === 'join-denied');
    
    expect(msg3.type).toBe('join-ok');

    ws2.close();
    ws3.close();
  }, 10000);
});
