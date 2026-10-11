# M3 Preparation Checklist

**Milestone:** M3 — From Me core + remote control  
**Status:** Preparation phase  
**Prerequisites:** M2 complete ✅

---

## Required Steps Before M3 Implementation

### 1. Manual M2 Verification (CRITICAL)
**Owner action required**

Test with two browsers to verify M2 works end-to-end:

#### Test Steps
1. Open two browser windows/tabs (Chrome recommended)
2. In window 1: Navigate to `http://localhost:5173` (or deployed URL)
3. Click "Create Room"
4. Copy the invite URL
5. In window 2: Paste invite URL and navigate
6. **Verify:**
   - ✅ Both windows show each other in peer list
   - ✅ Connection status progresses: disconnected → connecting → connected → ready
   - ✅ Both reach "Ready" state (green badge)
   - ✅ Room ID matches
   - ✅ Clipboard copy button works

#### Network Inspection (Optional but Recommended)
Open DevTools Network tab in both windows:
- Filter for WebSocket (WS) connections
- Verify handshake messages exchanged
- Confirm `key-exchange` messages contain JWK public keys
- Confirm server (Worker) never sees plaintext except peer metadata

**Exit criteria:** Both peers reach "Ready" state reliably.

---

### 2. Cloudflare Deployment Check (CRITICAL)
**Owner action required**

Verify Cloudflare signup requires no credit card for M2 features:

#### Steps
1. Sign up for Cloudflare account (if not already done)
2. Navigate to Workers & Pages
3. Deploy the edge Worker:
   ```bash
   cd apps/edge
   pnpm run deploy
   ```
4. Verify deployment succeeds without payment method prompt
5. Test deployed Worker WebSocket endpoint
6. Record deployed URLs for web app and Worker API

**Exit criteria:** Worker deploys successfully, WebSocket connections work in production.

**If card is required:** STOP and report. Do not add card. Document exact prompt text and which feature triggered it.

---

### 3. Spike S5: captureStream Test (MUST)
**Status:** Currently INVALID (wrong test run)  
**Environment:** Real Chrome browser (not Node.js)  
**Blocking:** M3 implementation cannot start until complete

#### What to Test
HTMLMediaElement.captureStream() functionality:

1. Create a test HTML page with:
   - `<video>` element with local video file
   - "Capture Stream" button
   - Second `<video>` element to display captured stream

2. Test script:
   ```javascript
   const sourceVideo = document.getElementById('source');
   const destVideo = document.getElementById('dest');
   
   // Load local video file
   sourceVideo.src = 'test-video.mp4'; // Replace with actual test file
   
   document.getElementById('captureBtn').addEventListener('click', () => {
     const stream = sourceVideo.captureStream();
     console.log('Captured stream tracks:', stream.getTracks());
     
     destVideo.srcObject = stream;
     destVideo.play();
   });
   ```

3. **Verify:**
   - ✅ captureStream() returns MediaStream
   - ✅ Stream has video track
   - ✅ Destination video plays captured stream
   - ✅ Audio track exists (if source has audio)
   - ✅ Seeking source video reflects in captured stream
   - ✅ Pausing source video pauses captured stream

4. **Document:**
   - Browser version tested
   - Video codec of test file
   - Any console warnings/errors
   - Measured latency from source to dest (rough estimate)

#### Expected Location
`docs/spikes/S5-capturestream-test.html` (standalone test page)  
`docs/spikes/S5-capturestream-results.md` (findings document)

**Exit criteria:** Test runs in real Chrome, captureStream() works, results documented.

---

### 4. Spike S1: Two-Network WebRTC Test (SHOULD)
**Status:** BLOCKED until M2 deployed  
**Environment:** Real Chrome, two different networks  
**Priority:** High (validates P2P connectivity across NATs)

#### What to Test
WebRTC peer connection establishment across different networks:

1. Deploy M2 to Cloudflare (prerequisite: step 2 complete)
2. Open deployed app on two devices:
   - **Device A:** Home WiFi (Windows PC/laptop)
   - **Device B:** Mobile hotspot or different WiFi network (MacBook)
3. Create room on Device A, join on Device B
4. Open browser DevTools → Console on both devices
5. Monitor ICE candidate gathering and connection state

**Verify:**
- ✅ ICE candidates include both devices' public IPs
- ✅ STUN server responses visible (stun.cloudflare.com, stun.l.google.com)
- ✅ Connection state reaches "connected"
- ✅ Data channel (or later, media stream) works across networks
- ✅ No TURN candidates used (STUN-only for M2-M4)

**Document:**
- Both networks' NAT types (symmetric, cone, etc.) if discoverable
- Which STUN server provided successful candidates
- Connection establishment time
- Any failures or retries

#### Expected Location
`docs/spikes/S1-two-network-webrtc.md`

**Exit criteria:** Peer connection establishes successfully across two different networks using STUN only.

**If it fails:** Document failure mode. This informs M5 TURN decision.

---

## Preparation Summary

| Step | Status | Blocking M3? | Owner Action Required |
|------|--------|--------------|----------------------|
| M2 manual verification | ⏳ Pending | YES | Test in two browsers |
| Cloudflare deployment check | ⏳ Pending | YES | Deploy Worker, verify no card needed |
| Spike S5 (captureStream) | ⚠️ Invalid | YES | Rerun in real Chrome |
| Spike S1 (two networks) | 🔵 Blocked | NO (Should-have) | After deployment |

**Next action:** Owner must complete M2 manual verification and Spike S5 before M3 workflow can start.

---

## What M3 Will Implement

Once prerequisites complete, M3 adds:

### Core Features (FR-201 to FR-207)
- **Video capture** from local file via captureStream()
- **WebRTC media streaming** (owner → partner via PeerConnection)
- **Remote control protocol** (play/pause/seek commands via encrypted WebSocket)
- **Theatre UI** with video player, timeline scrubber, playback controls
- **Cinema+ quality preset** (source resolution, adaptive bitrate based on upload speed)
- **Safari H.264 compatibility** (codec negotiation)

### Architecture
- `TheatrePage.tsx` - full playback UI
- `VideoPlayer.tsx` - HTMLVideoElement wrapper with controls
- `WebRTCPeer.ts` - PeerConnection management
- `SyncProtocol.ts` - play/pause/seek message encryption and handling
- `apps/edge` - ICE config endpoint (returns STUN servers only, no TURN)

### Acceptance Criteria
1. Owner loads local video file, streams to partner via WebRTC
2. Partner sees video playing in near-source quality
3. Partner can play/pause/seek via UI, owner's player responds
4. Latency <500ms for control commands
5. Video maintains sync within 1 second
6. Safari partner receives H.264 stream successfully

---

## Owner Answers Still Needed

From STATE.md:
- **My upload speed:** ___ Mbps (TBD)

This is needed for M3's Cinema+ bitrate calculation. Owner should measure upload speed and provide before M3 starts.

**How to measure:**
1. Visit fast.com or speedtest.net
2. Run upload speed test
3. Note the "Upload" value in Mbps
4. Update STATE.md

---

## After M3

M4 will add:
- Audio mixer (independent volume controls)
- Face bubbles (draggable/resizable video overlay)
- Companion device support
- Theatre UI polish

M5 will add:
- Voice/video calling (WebRTC audio)
- TURN relay decision (card required for Cloudflare)
- Format Doctor (upload speed detection, preset recommendation)

---

**Document last updated:** 2026-10-10
