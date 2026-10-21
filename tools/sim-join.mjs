#!/usr/bin/env node

import WebSocket from 'ws';
import { newRoomSecret, deriveRoomKeys, newPeerId } from '@matinee/protocol';

const BASE_URL = 'ws://127.0.0.1:8789';

function connectPeer(roomId, peerId) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${BASE_URL}/ws/${roomId}?p=${peerId}`);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

function waitForMessage(ws, filter) {
  return new Promise((resolve) => {
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (!filter || filter(msg)) {
        ws.off('message', handler);
        resolve(msg);
      }
    };
    ws.on('message', handler);
  });
}

async function main() {
  const roomId = `sim${Date.now().toString(36)}`;
  const secret = newRoomSecret();
  const { joinToken } = await deriveRoomKeys(secret, roomId);
  const peerId1 = newPeerId();
  const peerId2 = newPeerId();

  console.log('=== Simulating React StrictMode (connect, close, reconnect same peerId) ===');
  
  // First mount: connect
  console.log(`\n1. StrictMode first mount: connecting peer ${peerId1.slice(0, 6)}...`);
  const ws1 = await connectPeer(roomId, peerId1);
  ws1.send(JSON.stringify({ type: 'join', joinToken }));
  const res1 = await waitForMessage(ws1, m => m.type === 'join-ok');
  console.log(`   Result: ${res1.type}, role=${res1.role}`);

  // StrictMode unmount: close
  console.log(`\n2. StrictMode unmount: closing socket...`);
  ws1.close();
  await new Promise(r => setTimeout(r, 200));

  // StrictMode remount: reconnect same peerId
  console.log(`\n3. StrictMode remount: reconnecting peer ${peerId1.slice(0, 6)}...`);
  const ws2 = await connectPeer(roomId, peerId1);
  ws2.send(JSON.stringify({ type: 'join', joinToken }));
  const res2 = await waitForMessage(ws2, m => m.type === 'join-ok');
  console.log(`   Result: ${res2.type}, role=${res2.role}`);

  // Second peer joins
  console.log(`\n4. Second peer ${peerId2.slice(0, 6)} joins...`);
  const ws3 = await connectPeer(roomId, peerId2);
  ws3.send(JSON.stringify({ type: 'join', joinToken }));
  const res3 = await waitForMessage(ws3, m => m.type === 'join-ok' || m.type === 'join-denied');
  console.log(`   Result: ${res3.type}${res3.role ? `, role=${res3.role}` : ''}${res3.reason ? `, reason=${res3.reason}` : ''}`);

  console.log('\n=== Server join log lines (check wrangler dev output above) ===');
  console.log('Expected pattern:');
  console.log(`  join peer=${peerId1.slice(0, 6)} live=1 result=ok`);
  console.log(`  join peer=${peerId1.slice(0, 6)} live=1 result=replaced`);
  console.log(`  join peer=${peerId2.slice(0, 6)} live=2 result=ok`);

  ws2.close();
  ws3.close();
  
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
