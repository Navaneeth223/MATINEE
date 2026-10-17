You are the only engineer on "Matinee" (this folder; Windows PowerShell; pnpm monorepo:

apps/web = Vite+React, apps/edge = Cloudflare Worker + Durable Object, packages/protocol).

TARGET: the first watchable film night, ASAP. The owner on a Windows PC plays a local movie

file and sends it live to the partner on a MacBook (assume Safari). Both hear/see each other;

either can pause/seek; each controls their own volume. Free tools only; never a card.

FIRST ACTION: save this whole brief verbatim to docs/NEXT.md and commit. After any context

reset read docs/NEXT.md + STATE.md and continue at the first unfinished slice. AGENT_PROMPT.md

may not exist: ignore it. This brief is the source of truth.

RULES

1. No workflows. Edit and run directly.

2. Your tool dies after 30 s. Run long commands as background jobs writing to .tmp/out.txt

   (Start-Job ... *> .tmp/out.txt) and poll. Use `vitest run`, never watch mode.

3. Quiet: show the last 15 lines only. Never print whole files. Do not re-read a file you just wrote.

4. "Works" = pasted runner summary (test names + counts). tsc passing proves nothing.

5. If the same step fails twice: stop guessing. Show the first error + 15 lines of context to the owner.

6. Commit after each slice on a branch; merge to main only when that slice's acceptance tests pass.

   Never commit build/test output. .gitignore: dist, .wrangler*, test-results, playwright-report, .tmp.

7. Reports to the owner: max 6 lines (Done / Proof / Next / Owner needs). STATE.md: max 15 lines, at the end of each slice only.

8. Security invariants, never weaken: the server never sees the room secret or any plaintext;

   EVERY app message (chat, SDP, ICE, commands, state) goes through Session.seal/open;

   room cap 2; join token; no secrets in logs.

9. Known traps: apps use @matinee/protocol from src via alias (verify the alias exists in web

   vite.config AND edge vitest.config; protocol vitest excludes dist); dev server = port 8788

   (wrangler.toml), test server = 8789 (wrangler.test.toml, short timeouts); Playwright must

   use a NEW browser context per person; navigating to the same URL with a different #hash

   does not reload the page; React StrictMode double-mounts, so effect cleanup must close sockets.

   Playwright's webServer config must start wrangler and vite itself (reuseExistingServer).

SLICE 0: hygiene + prove M2 (you alone)

- git rm -r --cached --ignore-unmatch apps/edge/.wrangler-dry apps/web/test-results

  apps/web/playwright-report pw-output.txt test-out.txt packages/protocol/tsconfig.tsbuildinfo; commit.

- Make Playwright PW-01..04 pass: A creates a room and the #k fragment leaves the address bar;

  B (new context) opens A's invite link (use the Copy button/data attribute) and both say Connected;

  chat both ways; C (new context) gets "room full"; D (new context, wrong secret) is refused;

  no relayed frame contains plaintext. Integration tests 10/10 on 8789.

- Merge to main. OWNER CHECK 1: give the owner 5 numbered lines to try it by hand.

SLICE 1: feasibility spike, real Chromium via Playwright (you alone)

- Page A plays a generated test clip (canvas + oscillator via MediaRecorder, or a tiny CC0 webm),

  captureStream(), sends it over RTCPeerConnection to page B on localhost.

  Prove: B video.videoWidth > 0, currentTime advancing, inbound-rtp framesDecoded rising, audio level > 0.

- Prove volume independence: audio taken through WebAudio (MediaElementSource -> local gain -> speakers,

  and -> MediaStreamDestination for the stream). Host local gain = 0 must NOT change the audio level B receives.

- Write docs/spikes/S5.md with the numbers. If it fails, report immediately with 15 lines and stop.

SLICE 2: "From Me" core

- After joining, whoever picks a file is the source (symmetric roles). <input type=file>; minimal Format

  Doctor: canPlayType check and a plain message with the ffmpeg remux recipe for MKV/HEVC/AC-3.

- Perfect negotiation; SDP/ICE sealed through the existing relay. ICE servers: stun.cloudflare.com:3478 and

  stun.l.google.com:19302. No TURN yet: if ICE fails after 15 s show "your network needs a relay".

- Sender: maxBitrate 4 Mbps (Cinema+ default; later 70% of measured upload), degradationPreference

  'maintain-resolution', contentHint 'motion'; prefer H.264 if the peer reports Safari; viewer jitter buffer

  target about 2 s (jitterBufferTarget or playoutDelayHint, where supported).

- Remote control: viewer play/pause/seek/±10 s -> sealed 'cmd' -> source executes -> source sends 'state'

  -> both UIs update; the viewer's scrubber shows the source position.

- Acceptance PW-05 video arrives; PW-06 viewer pause pauses the source within 800 ms; PW-07 viewer seek moves

  the source within 1 s; PW-08 volumes are independent. OWNER CHECK 2.

SLICE 3: theatre essentials

- Fullscreen, auto-hide controls, dark ink + champagne look from packages/ui-tokens (clean, not fancy yet).

- Mixer on both sides: movie volume 0-100% + Boost to 300% on the viewer (GainNode + DynamicsCompressor

  limiter); partner voice volume; mute buttons; saved per device in localStorage.

- Face bubbles: draggable, resizable (handle + S/M/L), circle/square, snap to corners, hide; they stay

  inside the fullscreen element. Tests for gain values and bubble drag/resize.

SLICE 4: voice + video

- getUserMedia mic (echo cancellation + noise suppression toggles, device pickers, level meter, Opus mono

  32-48 kbps) and optional camera (off by default) on the same peer connection (renegotiate).

- Chrome quirk: remote audio into WebAudio needs the stream also attached to a muted media element; verify.

- Tests use --use-fake-device-for-media-stream --use-fake-ui-for-media-stream; remote audio level > 0.

SLICE 5: deploy + first real test

- `npx wrangler whoami` must succeed. Deploy ONE Worker (static assets + API + Durable Object, workers.dev,

  new_sqlite_classes migration, production timeouts). Verify /api/health. If it asks for a card: STOP, tell the owner.

- Give the owner the URL and a 6-step script for the call with the partner. Add a simple Doctor screen showing

  ICE candidate type (host/srflx/relay), RTT, measured upload (data-channel burst), video bitrate, dropped frames.

  Save results to docs/spikes/two-network.md.

- If the partner's network needs a relay, STOP and ask the owner (relay options must be card-free).

NOT NOW: subtitles, Together mode, Share Screen/VLC fallback, mobile polish, SAS/knock/lock.

Do not ask permission between slices; stop only at OWNER CHECKS, STOP lines, or rule 5.
