# Project State

## Completed
**SLICE 2 "From Me" — WebRTC streaming with E2EE rooms**: Two browsers connect via WebSocket relay (apps/edge), exchange sealed messages (16-byte secret, AES-GCM-256), negotiate WebRTC with perfect negotiation pattern, stream video+audio from source to viewer. Source uses WebAudio branch (MediaElementSource → localGain → speakers + MediaStreamDestination → peer) so local volume never affects stream. Viewer has play/pause/seek controls (send 'cmd', source executes, replies 'state'), volume 0-100% + boost to 300% with DynamicsCompressor limiter, settings saved per device. Dark theme (#08070B bg, #E7C98E accent). Room flow: create room → copy invite (22-char secret) → partner joins → hash stripped for all users → chat (You/Partner, Enter sends) → stream film. ICE: Cloudflare+Google STUN; 15s timeout shows "relay needed" warning. Format Doctor detects AC-3/Dolby audio, shows ffmpeg command. Session survives reload (secret in sessionStorage per room, stable peerId per tab+room). Protocol tests: 28/28 vitest pass. Build: tsc clean, vite build passes.

## Current blockers
None. Manual testing required (no Playwright budget).

## Next
Manual test per docs/MANUAL-TEST.md (two windows, then second device). If pass: deploy apps/edge to Cloudflare, update DEPLOY.md with URL.
