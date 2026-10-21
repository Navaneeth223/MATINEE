# Project State

## Completed
- **SLICE 2 core**: WebSocket relay (apps/edge DO), sealed messages (16-byte=22-char secret, AES-GCM-256), WebRTC perfect negotiation, streaming
- **Server B1**: capacity = distinct admitted peerIds among LIVE sockets; replacement closes old socket (1000 'replaced'); vitest 3/3 pass
- **Client B2**: useRoom cancelled flag in cleanup, StrictMode = one live connection, sessionStorage peerId+secret per room
- **Styling B3**: plain CSS 6.2KB (bg #08070B, accent #E7C98E), layout stage+chat, presence dots, Copy invite
- **Source C1**: Film/Screen selector, Format Doctor (AC-3 warning + ffmpeg), getDisplayMedia coaching, DRM detection, Cinema+ quality (4.5Mbps maintain-resolution H.264-first), Safari check

## Inventory (C1 exists, C2 incomplete)
| Component | Status | Lines | Notes |
|-----------|--------|-------|-------|
| SourcePanel | ✓ C1 | 233 | Film/Screen modes, quality settings |
| ViewerPanel | Partial | 158 | Start watching, controls, boost; needs mixer UI |
| WebRTCClient | ✓ C1 | 135 | Quality params, Safari codec preference |
| useRoom | ✓ B2 | 152 | Cancelled flag, stable peerId |
| room-do.ts | ✓ B1 | 406 | Live capacity, replacement |

## Current blockers
Context 121K/200K. Starting D0: reproduce "Room is full" bug, fix client+server, E2E test, manifest, zero console errors.

## Next command
Create Playwright E2E test that reproduces "Room is full" bug with two contexts on wrangler.test.toml + vite dev harness.
