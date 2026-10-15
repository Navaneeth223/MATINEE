# Matinee Project State

## Current Milestone: M2 - E2EE Rooms (COMPLETE)

### M2 Implementation Status

**Branch:** `m2c`

**Completed:**
- ✅ `packages/protocol/src/seal.ts` - AES-GCM-256 encryption with Session class (21 tests passing)
- ✅ `apps/edge/src/room-do.ts` - Durable Object with joinToken auth, 2-peer cap, 12h expiry
- ✅ `apps/web/src/lib/room-client.ts` - WebSocket client with Session.seal/open, reconnect with backoff
- ✅ `apps/web/src/pages/FoyerPage.tsx` - Room creation UI (generates roomId + secret in #fragment)
- ✅ `apps/web/src/pages/RoomPage.tsx` - Room UI with E2EE chat
- ✅ Integration tests: 9/9 passing against wrangler dev (double join, peers list, extra fields stripped, wrong token, room full, rate limit, no storage writes per relay, half-open eviction)
- ✅ Alarm-based unadmitted socket timeout (configurable via wrangler vars for testing)

**Architecture:**
- **Encryption:** Session.seal/open using AES-GCM-256, per-session replay protection via (sid, seq) tracking
- **Auth:** sha256(joinToken) stored in DO, first peer creates room, subsequent peers must match hash
- **Capacity:** maxPeers=2, half-open eviction (sockets silent >60s removed when room full)
- **Expiry:** 12h idle timeout, alarm-based cleanup
- **Rate limiting:** Token bucket (40 burst, 20/sec sustained), cost = bytes/1024
- **Server relay:** Strips extra fields from envelopes, validates v/t/from/to/seq/sid/iv/ct, never reads `ct` plaintext
- **Storage:** joinTokenHash, createdAt, lastActiveAt, maxPeers, admitted[] in DO storage; all security state persisted (hibernation-safe)
- **Client:** 30s ping/pong with 10s timeout, reconnect with exponential backoff, NEW Session per connection, emits 'msg:'+type events

**Deferred to M11:**
- ECDH forward secrecy (ADR: simpler room-key model for M2, full PFS in M11)
- SAS word verification
- Knock/approve flow

**Testing:**
- Unit tests: 21 passing (seal.ts)
- Integration tests: 9/9 passing (room-do.ts via wrangler dev)
- Manual: Owner must verify two-browser flow (create room, join, chat both ways, third context gets "room full")

**Files modified:**
- `packages/protocol/src/seal.ts` (new)
- `packages/protocol/src/seal.test.ts` (new)
- `packages/protocol/src/index.ts` (export seal types)
- `apps/edge/src/room-do.ts` (rewritten)
- `apps/edge/test/room.integration.test.ts` (new)
- `apps/edge/wrangler.toml` (added [dev] port = 8788, migration tag v1)
- `apps/edge/wrangler.test.toml` (new, with fast timeouts for tests)
- `apps/edge/package.json` (added pretest script)
- `apps/web/src/lib/room-client.ts` (rewritten)
- `apps/web/src/pages/FoyerPage.tsx` (new)
- `apps/web/src/pages/RoomPage.tsx` (new)
- `apps/web/App.tsx` (routes already configured)
- `apps/web/vite.config.ts` (added proxy for /api and /ws)
- Deleted: `apps/web/src/lib/crypto.ts`, `crypto.test.ts`, `bip39-words.ts`, `__test-e2ee__.ts`

**Next Steps:**
1. Owner: Manual test with two browsers (create room, verify #k= fragment stripped, join from second browser, send messages both ways, verify third browser gets "room full")
2. If manual test passes: Deploy to Cloudflare Workers with `cd apps/edge && wrangler deploy` (will prompt for project name and migration confirmation)
3. Update SPEC-M2B.md with deployment URL
4. Merge m2c → main

**Migration Note:**
The Durable Object uses `new_sqlite_classes = ["RoomDO"]` (free tier compatible). First deploy will create the migration.

---

## Previous Work

### M1 - Completed
- Basic sync protocol design
- WebRTC signaling exploration
- Project structure (monorepo with pnpm workspaces)

### Documentation
- `docs/SPEC-M2B.md` - M2 specification (joinToken auth, 2-peer E2EE)
- `docs/DECISIONS.md` - ADR log (includes M2 crypto simplification decision)
- `docs/ASSUMPTIONS.md` - Project assumptions
- `docs/RISKS.md` - Risk register
- `docs/FREE-TIER-LEDGER.md` - Free tier budget tracking

### Dependencies
- Cloudflare Workers + Durable Objects (edge)
- Vite + React (web)
- Vitest (protocol + edge tests)
- WebCrypto API (seal.ts encryption)

### Dev Environment
- Node.js with pnpm
- TypeScript 5.9.3
- Wrangler 4.149.0
- Two dev servers: edge (port 8788), web (port 5173 with proxy)
