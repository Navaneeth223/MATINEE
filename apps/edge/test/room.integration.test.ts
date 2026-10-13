/**
 * Integration tests for room-do.ts against wrangler dev (real runtime)
 * Tests: joinToken auth, 2-peer cap, relay, rate limit, expiry
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { newRoomSecret, deriveRoomKeys, newPeerId } from '@matinee/protocol';

const WRANGLER_URL = 'ws://localhost:8787';
const ROOM_ID = 'TESTROOM01';

function connectPeer(peerId: string): WebSocket {
  return new WebSocket(`${WRANGLER_URL}/ws/${ROOM_ID}?p=${peerId}`);
}

function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), timeout);
    ws.once('message', (data) => {
      clearTimeout(timer);
      resolve(JSON.parse(data.toString()));
    });
    ws.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

describe('RoomDO integration (wrangler dev)', () => {
  it('a) host with joinToken: admitted', async () => {
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, ROOM_ID);
    const peerId = newPeerId();

    const ws = connectPeer(peerId);
    await new Promise((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'join', joinToken }));
    const response = await waitForMessage(ws);

    expect(response.type).toBe('join-ok');
    expect(response.role).toBe('creator');

    ws.close();
  });

  it('b) guest with same token: admitted', async () => {
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, ROOM_ID);

    const host = connectPeer(newPeerId());
    await new Promise((resolve) => host.once('open', resolve));
    host.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(host);

    const guest = connectPeer(newPeerId());
    await new Promise((resolve) => guest.once('open', resolve));
    guest.send(JSON.stringify({ type: 'join', joinToken }));
    const response = await waitForMessage(guest);

    expect(response.type).toBe('join-ok');
    expect(response.role).toBe('joiner');

    host.close();
    guest.close();
  });

  it('c) wrong joinToken: rejected', async () => {
    const secret1 = newRoomSecret();
    const { joinToken: correctToken } = await deriveRoomKeys(secret1, ROOM_ID);

    const host = connectPeer(newPeerId());
    await new Promise((resolve) => host.once('open', resolve));
    host.send(JSON.stringify({ type: 'join', joinToken: correctToken }));
    await waitForMessage(host);

    const secret2 = newRoomSecret();
    const { joinToken: wrongToken } = await deriveRoomKeys(secret2, ROOM_ID);

    const intruder = connectPeer(newPeerId());
    await new Promise((resolve) => intruder.once('open', resolve));
    intruder.send(JSON.stringify({ type: 'join', joinToken: wrongToken }));

    const response = await waitForMessage(intruder);
    expect(response.type).toBe('join-denied');
    expect(response.reason).toBe('Wrong secret');

    host.close();
  });

  it('d) third peer: gets full', async () => {
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, ROOM_ID);

    const host = connectPeer(newPeerId());
    await new Promise((resolve) => host.once('open', resolve));
    host.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(host);

    const guest = connectPeer(newPeerId());
    await new Promise((resolve) => guest.once('open', resolve));
    guest.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(guest);

    const third = connectPeer(newPeerId());
    await new Promise((resolve) => third.once('open', resolve));
    third.send(JSON.stringify({ type: 'join', joinToken }));

    const response = await waitForMessage(third);
    expect(response.type).toBe('join-denied');
    expect(response.reason).toBe('Room full');

    host.close();
    guest.close();
  });

  it('e) frame over 64 KiB: connection closed', async () => {
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, ROOM_ID);
    const peerId = newPeerId();

    const ws = connectPeer(peerId);
    await new Promise((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws);

    const closePromise = new Promise((resolve) => ws.once('close', resolve));

    const hugeFrame = JSON.stringify({ type: 'ping', data: 'x'.repeat(70000) });
    ws.send(hugeFrame);

    await closePromise;
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  it('f) 41st message in burst: rate-limited', async () => {
    const secret = newRoomSecret();
    const { joinToken } = await deriveRoomKeys(secret, ROOM_ID);
    const peerId = newPeerId();

    const ws = connectPeer(peerId);
    await new Promise((resolve) => ws.once('open', resolve));

    ws.send(JSON.stringify({ type: 'join', joinToken }));
    await waitForMessage(ws);

    const closePromise = new Promise((resolve) => ws.once('close', resolve));

    // Send 41 pings rapidly
    for (let i = 0; i < 41; i++) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }

    await closePromise;
    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });
});
