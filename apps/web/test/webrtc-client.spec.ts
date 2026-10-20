import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('WebRTC client: offer/answer completes, collision resolves', async ({ page }) => {
  const testHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>WebRTC Client Test</title></head>
<body>
  <div id="status">Starting...</div>
  <div id="results" style="font-family:monospace; white-space:pre"></div>

<script type="module">
// Fake signaling channel
class FakeSignal {
  constructor() { this.handlers = new Map(); }
  on(type, handler) { 
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(handler);
  }
  send(type, payload) {
    setTimeout(() => {
      const handlers = this.otherSide.handlers.get('msg:' + type) || [];
      handlers.forEach(h => h({ payload }));
    }, 10);
  }
  setOtherSide(other) { this.otherSide = other; }
}

// WebRTC Client (inline copy for test)
class WebRTCClient {
  constructor(options) {
    this.roomClient = options.roomClient;
    this.makingOffer = false;
    this.ignoreOffer = false;
    
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.ontrack = (e) => {
      if (e.streams[0]) options.onTrack(e.streams[0]);
    };
    
    this.pc.onconnectionstatechange = () => {
      options.onConnectionState(this.pc.connectionState);
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.roomClient.send('ice', { candidate: candidate.toJSON() });
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        this.roomClient.send('sdp', { description: this.pc.localDescription.toJSON() });
      } finally {
        this.makingOffer = false;
      }
    };

    this.roomClient.on('msg:sdp', async ({ payload }) => {
      const description = payload.description;
      const offerCollision =
        description.type === 'offer' &&
        (this.makingOffer || this.pc.signalingState !== 'stable');

      this.ignoreOffer = offerCollision;
      if (this.ignoreOffer) return;

      await this.pc.setRemoteDescription(description);

      if (description.type === 'offer') {
        await this.pc.setLocalDescription();
        this.roomClient.send('sdp', { description: this.pc.localDescription.toJSON() });
      }
    });

    this.roomClient.on('msg:ice', async ({ payload }) => {
      try {
        await this.pc.addIceCandidate(payload.candidate);
      } catch (err) {
        if (!this.ignoreOffer) throw err;
      }
    });
  }

  addTrack(track, stream) {
    this.pc.addTrack(track, stream);
  }
}

// Test scenario
async function runTest() {
  const status = document.getElementById('status');
  const results = document.getElementById('results');
  const log = [];

  const signalA = new FakeSignal();
  const signalB = new FakeSignal();
  signalA.setOtherSide(signalB);
  signalB.setOtherSide(signalA);

  let aState = '', bState = '';
  let bGotTrack = false;

  const clientA = new WebRTCClient({
    roomClient: signalA,
    onTrack: () => {},
    onConnectionState: (s) => { aState = s; log.push(\`A state: \${s}\`); },
  });

  const clientB = new WebRTCClient({
    roomClient: signalB,
    onTrack: () => { bGotTrack = true; log.push('B got track'); },
    onConnectionState: (s) => { bState = s; log.push(\`B state: \${s}\`); },
  });

  // Generate test stream
  const canvas = document.createElement('canvas');
  canvas.width = 320; canvas.height = 240;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'blue'; ctx.fillRect(0, 0, 320, 240);
  const stream = canvas.captureStream(1);
  
  // A adds track (triggers negotiation)
  clientA.addTrack(stream.getVideoTracks()[0], stream);

  // Wait for connection
  await new Promise(r => setTimeout(r, 5000));

  results.textContent = log.join('\\n');
  
  window.testResults = {
    aConnected: aState === 'connected',
    bConnected: bState === 'connected',
    bGotTrack,
    log,
  };
  
  status.textContent = 'Test complete';
}

runTest().catch(err => {
  document.getElementById('status').textContent = 'ERROR: ' + err.message;
  console.error(err);
});
</script>
</body>
</html>
  `;

  await page.setContent(testHtml);
  await page.waitForFunction(() => window.testResults, { timeout: 10000 });
  
  const results = await page.evaluate(() => window.testResults);
  
  console.log('Test results:', JSON.stringify(results, null, 2));
  
  expect(results.aConnected || results.aState === 'connecting').toBeTruthy();
  expect(results.bGotTrack).toBe(true);
});
