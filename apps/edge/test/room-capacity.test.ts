import { describe, it, expect } from 'vitest';
import { newRoomSecret, deriveRoomKeys, newPeerId } from '@matinee/protocol';
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

describe('room capacity and replacement', () => {
  it('(a) same peerId joins twice, then a DIFFERENT peer joins -> admitted', async () => {
    const roomId = `testa${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerA = newPeerId();
    const peerB = newPeerId();

    // Connect peerId A first time
    const ws1 = await connectPeer(roomId, peerA);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    const res1 = await waitForMessage(ws1, m => m.type === 'join-ok');
    expect(res1.type).toBe('join-ok');
    expect(res1.role).toBe('creator');

    // Connect peerId A second time (replacement)
    const ws2 = await connectPeer(roomId, peerA);
    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    const res2 = await waitForMessage(ws2, m => m.type === 'join-ok');
    expect(res2.type).toBe('join-ok');

    // Wait for old socket to close
    await sleep(500);

    // Connect different peer B
    const ws3 = await connectPeer(roomId, peerB);
    ws3.send(JSON.stringify({ type: 'join', joinToken }));
    const res3 = await waitForMessage(ws3, m => m.type === 'join-ok');
    expect(res3.type).toBe('join-ok');

    ws2.close();
    ws3.close();
  }, 10000);

  it('(b) creator socket closes mid-handshake then a joiner -> admitted', async () => {
    const roomId = `testb${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerA = newPeerId();
    const peerB = newPeerId();

    // Creator connects
    const ws1 = await connectPeer(roomId, peerA);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    const res1 = await waitForMessage(ws1, m => m.type === 'join-ok');
    expect(res1.type).toBe('join-ok');
    expect(res1.role).toBe('creator');

    // Close immediately
    ws1.close();
    await sleep(500);

    // Joiner connects
    const ws2 = await connectPeer(roomId, peerB);
    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    const res2 = await waitForMessage(ws2, m => m.type === 'join-ok' || m.type === 'join-denied');
    expect(res2.type).toBe('join-ok');

    ws2.close();
  }, 10000);

  it('(c) third distinct peer -> full', async () => {
    const roomId = `testc${Date.now().toString(36)}`;
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, roomId);
    const peerA = newPeerId();
    const peerB = newPeerId();
    const peerC = newPeerId();

    // Connect peer A
    const ws1 = await connectPeer(roomId, peerA);
    ws1.send(JSON.stringify({ type: 'join', joinToken }));
    const res1 = await waitForMessage(ws1, m => m.type === 'join-ok');
    expect(res1.type).toBe('join-ok');

    // Connect peer B
    const ws2 = await connectPeer(roomId, peerB);
    ws2.send(JSON.stringify({ type: 'join', joinToken }));
    const res2 = await waitForMessage(ws2, m => m.type === 'join-ok');
    expect(res2.type).toBe('join-ok');

    // Connect peer C (third distinct)
    const ws3 = await connectPeer(roomId, peerC);
    ws3.send(JSON.stringify({ type: 'join', joinToken }));
    const res3 = await waitForMessage(ws3, m => m.type === 'join-denied');
    expect(res3.type).toBe('join-denied');
    expect(res3.reason).toBe('Room full');

    ws1.close();
    ws2.close();
  }, 10000);
});
