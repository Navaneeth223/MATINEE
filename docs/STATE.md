# Project State

## Completed
**SLICE 2 "From Me" — WebRTC streaming with E2EE rooms**: Two browsers connect via WebSocket relay (apps/edge Durable Object), exchange sealed messages (16-byte secret = 22-char invite, AES-GCM-256), negotiate WebRTC with perfect negotiation, stream video+audio. Server capacity tracks DISTINCT admitted peerIds among LIVE sockets (not stored array); same peerId rejoining closes old socket (1000 'replaced'), count stays 1, no spurious presence events. Client useRoom has `cancelled` flag in cleanup; React StrictMode produces exactly one live connection. Source uses WebAudio branch (MediaElementSource → localGain → speakers + MediaStreamDestination → peer) so local volume never affects stream. Viewer: play/pause/seek controls (send sealed 'cmd', source executes, replies sealed 'state'), volume 0-100% + boost to 300% with DynamicsCompressor limiter, saved per device. Format Doctor: detects AC-3/Dolby audio after 2s play, shows ffmpeg command. Plain CSS styling (6.2KB asset): bg #08070B, accent #E7C98E, layout stage 16:9 left + chat 340px right (stacked <1024px), top bar with Matinee/room-code/presence-dots/Copy-invite. Hash stripped for all users, secret/peerId in sessionStorage, reload works. Protocol vitest 28/28 pass. Build: tsc clean, vite 6.2KB CSS.

## Current blockers
None. Manual testing required (no Playwright).

## Next
Manual test per docs/MANUAL-TEST.md (two windows + second device). If pass: deploy apps/edge to Cloudflare Workers, update docs/DEPLOY.md with live URL.
