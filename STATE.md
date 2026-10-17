# Matinee Project State

## Current Milestone: M2 - E2EE Rooms (BLOCKED)

**Status:** M2 implementation blocked on chat delivery bug

**Blocker:** Playwright test fails at "Peer: Hello from A" - messages do not arrive between contexts.

### Debug Evidence (2026-10-15)

**Test logs show:**
```
[A ← ] {"type":"join","joinToken":"..."}
[A → ] {"type":"join-ok","role":"creator","peers":[]}
[B ← ] {"type":"join","joinToken":"ZN25wMOIthNEOPzdXSDXhcCT8YXtmOS31V5DHUmnysM"}
[B → ] {"type":"join-denied","reason":"Wrong secret"}
[B] Wrong secret - join denied as expected
[B websocket] closed
```

**Root cause identified:** After pageB tests wrong secret (websocket closes), navigating to correct URL doesn't re-create websocket. React's useEffect doesn't re-run because roomId param stays the same. The component needs to detect URL fragment changes or force remount.

**Findings:**
1. (a) B's socket does NOT receive the envelope frame - no websocket exists after wrong-secret test
2. (b) Session.open() never called - no websocket to receive messages
3. Event name mismatch: NO - RoomPage listens to 'msg:chat', client emits 'msg:'+type correctly
4. B's URL is built from A's data-invite-url attribute correctly
5. Client decrypt-error surfacing: added to room-client.ts

**Integration tests:** 9/9 passing (double join, peers list, extra fields stripped, wrong token, room full, rate limit, half-open eviction)

**What works:**
- seal.ts encryption (21 unit tests pass)
- room-do.ts server logic (9 integration tests pass)
- room-client.ts WebSocket + Session (works in integration tests)
- RoomPage UI + Copy invite button

**What's broken:**
- Playwright test: B doesn't reconnect after wrong secret, so correct secret test never gets a websocket
- Fix needed: Force RoomPage remount when URL changes, or add key={window.location.hash} to route

### M2 Branch Status

**Branch:** `m2c`

**Not Ready For:**
- ❌ Manual testing (blocked on Playwright pass)
- ❌ Deployment (blocked on acceptance test)
- ❌ Merge to main (blocked on acceptance test)

**Next Steps:**
1. Fix RoomPage useEffect to handle fragment-only URL changes
2. Rerun Playwright test until green (bidirectional chat, fragment stripped, third context full, wrong secret refused)
3. Then manual test and deployment

---

## Architecture Summary

- **Encryption:** Session.seal/open using AES-GCM-256, per-session replay protection
- **Auth:** sha256(joinToken) stored in DO
- **Capacity:** 2 peers, half-open eviction (silent >60s)
- **Expiry:** 12h idle, alarm-based cleanup
- **Rate limiting:** Token bucket (40 burst, 20/sec), cost=bytes/1024
- **Storage:** hibernation-safe (all state in DO storage or socket attachments)

**Files:**
- `packages/protocol/src/seal.ts` (new)
- `apps/edge/src/room-do.ts` (rewritten)
- `apps/web/src/lib/room-client.ts` (rewritten)
- `apps/web/src/pages/{FoyerPage,RoomPage}.tsx` (new)
- Tests: `seal.test.ts` (21 pass), `room.integration.test.ts` (9 pass), `two-browser.spec.ts` (blocked)

**Deferred to M11:** ECDH forward secrecy, SAS words, knock/approve
