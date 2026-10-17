# Matinee State

## M2: E2EE Rooms (DONE)
- seal.ts: AES-GCM-256, 21 tests pass
- room-do.ts: joinToken auth, 2-peer cap, alarm-based timeouts, 9/10 integration tests pass
- room-client.ts: 30s ping, reconnect with exponential backoff
- FoyerPage/RoomPage: Create room, Copy invite, bidirectional chat
- Manual two-browser test: PASS

## Dev Setup
- Normal dev: `cd apps/edge && pnpm run dev` (port 8788), `cd apps/web && pnpm run dev` (port 5173)
- Tests: wrangler.test.toml on 8789, integration tests use 8789
- Protocol alias: web/edge vite configs point to `packages/protocol/src/index.ts` (no rebuild needed)

## Next
- M3: Playback sync
