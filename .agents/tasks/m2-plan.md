# M2 Implementation Plan: Rooms + E2EE + Presence + Invite

**Milestone:** M2 — Rooms, End-to-End Encryption, Presence, and Invite Links  
**Requirements:** FR-101, FR-102, FR-701, FR-702, FR-703  
**Priority:** E2EE must be implemented BEFORE any messaging (per REQUIREMENTS.md §6)

## Exploration Summary

**Monorepo structure:** pnpm workspaces with turbo, TypeScript 5.9.3  
**Backend:** Cloudflare Workers + Durable Objects (apps/edge)  
**Frontend:** Vite + React 18 + Zustand (apps/web)  
**Protocol types:** Already defined in packages/protocol/src/index.ts  
**Current state:** Partial room API exists (returns roomId only), WebSocket upgrade works, but missing presence broadcasts and E2EE relay.

**Routing conflict identified:** App.tsx currently maps `/room/:roomId` to TheatrePage (intended for full Theatre playback UI). M2 requires a RoomPage for the waiting room (invite/presence). **Resolution:** Change `/room/:roomId` to render RoomPage (waiting room), add `/theatre/:roomId` for TheatrePage (full playback, later milestone).

**Verification approach:** Run both dev servers (edge on :8787, web on :5173), test with two browser tabs, verify WebSocket connection, E2EE key exchange, and presence broadcasts in browser console.

---

## Implementation Steps

- [ ] 1. **Update protocol types for presence messages**
      Add 'peer-joined' and 'peer-left' to WSMessageType union in packages/protocol/src/index.ts. Define PeerJoinedPayload and PeerLeftPayload interfaces.
      Files: packages/protocol/src/index.ts
      Verify: `pnpm --filter @matinee/protocol typecheck` passes with no errors.

- [ ] 2. **Extend POST /api/rooms to return invite URL**
      Modify handleRooms() in apps/edge/src/index.ts to construct inviteUrl from request.url origin and roomId. Return { roomId, inviteUrl } in response.
      Files: apps/edge/src/index.ts
      Verify: `pnpm --filter @matinee/edge dev`, then `curl -X POST http://localhost:8787/api/rooms` shows both roomId and inviteUrl fields.

- [ ] 3. **Add presence broadcasts to Durable Object**
      In apps/edge/src/room-do.ts:
      - After acceptWebSocket in fetch(), broadcast peer-joined message to all existing sessions with new peer's info
      - In webSocketClose() and webSocketError(), broadcast peer-left message before removing from sessions
      - Add getCurrentPeers() helper to return Peer[] from sessions map
      - In webSocketMessage handler, relay type='key-exchange' messages to all other peers without storing (E2EE relay)
      Files: apps/edge/src/room-do.ts
      Verify: `pnpm --filter @matinee/edge typecheck` passes. Manual WebSocket test with two connections shows peer-joined/peer-left broadcasts.

- [ ] 4. **Create E2EE crypto utilities**
      Create apps/web/src/lib/crypto.ts with:
      - generateKeyPair(): ECDH P-256 key generation
      - exportPublicKey(publicKey): export to JsonWebKey
      - importPublicKey(jwk): import from JsonWebKey
      - deriveSharedSecret(privateKey, peerPublicKey, roomId): ECDH + HKDF-SHA-256 with roomId salt → AES-GCM-256 key
      - encryptMessage(key, plaintext): AES-GCM encrypt → EncryptedEnvelope with base64 iv/ciphertext
      - decryptMessage(key, envelope): AES-GCM decrypt → plaintext string
      Add JSDoc comments to all functions.
      Files: apps/web/src/lib/crypto.ts
      Verify: `pnpm --filter @matinee/web typecheck` passes with no errors.

- [ ] 5. **Create E2EE test harness**
      Create apps/web/src/lib/__test-e2ee__.ts with testE2EE() function that:
      - Generates two key pairs (simulating two peers)
      - Derives shared secrets on both sides using same roomId
      - Encrypts message with one key, decrypts with other
      - Logs success/failure to console
      Export testE2EE() for browser console execution.
      Files: apps/web/src/lib/__test-e2ee__.ts
      Verify: In browser console, import and run testE2EE(), confirm console shows successful round-trip encryption.

- [ ] 6. **Create RoomClient class**
      Create apps/web/src/lib/room-client.ts with RoomClient class:
      - Constructor: (roomId, peerId, displayName)
      - connect(): Opens WebSocket, generates key pair, sends key-exchange message, sets up message handlers
      - WebSocket message handler: On 'key-exchange', derives shared key and stores in map. On 'peer-joined'/'peer-left', emits events. Emits 'ready' when all keys exchanged.
      - sendMessage(type, payload, encrypt=true): Encrypts (if encrypt=true and ready) and sends WSMessage
      - on(event, handler): Event subscription with unsubscribe return
      - disconnect(): Closes WebSocket, clears state
      Integration: Update roomStore.setPeers() on peer-joined/peer-left events.
      Files: apps/web/src/lib/room-client.ts
      Verify: `pnpm --filter @matinee/web typecheck` passes. Manual two-tab test shows 'ready' event fires after key exchange.

- [ ] 7. **Update FoyerPage with Create Room button**
      Modify apps/web/src/pages/FoyerPage.tsx:
      - Add Create Room button
      - On click: POST to http://localhost:8787/api/rooms (use VITE_EDGE_URL env var if available)
      - Receive { roomId, inviteUrl }, navigate to /room/{roomId} using useNavigate()
      Add i18n string 'create_room' to locales/en.json (and placeholder in th.json, ml.json).
      Files: apps/web/src/pages/FoyerPage.tsx, apps/web/src/locales/en.json, apps/web/src/locales/th.json, apps/web/src/locales/ml.json
      Verify: `pnpm --filter @matinee/web typecheck` passes. Click button, verify navigation to /room/:roomId.

- [ ] 8. **Create RoomPage (waiting room UI)**
      Create apps/web/src/pages/RoomPage.tsx:
      - Extract roomId from useParams()
      - Display room ID prominently
      - Display invite URL in readonly input with Copy button (navigator.clipboard.writeText)
      - Display peer list from roomStore.peers (name + join time)
      - Display connection status indicator (disconnected/connecting/connected/ready with color coding)
      - useEffect: Generate peerId, get displayName from userPrefsStore, create RoomClient, connect(), set up event listeners for peer-joined/peer-left/ready/connected, update roomStore. Clean up on unmount.
      Add i18n strings: 'room_id', 'invite_url', 'copy_invite', 'peers_in_room', 'connection_status', 'status_disconnected', 'status_connecting', 'status_connected', 'status_ready'.
      Files: apps/web/src/pages/RoomPage.tsx, apps/web/src/locales/en.json, apps/web/src/locales/th.json, apps/web/src/locales/ml.json
      Verify: `pnpm --filter @matinee/web typecheck` passes. Open room page, verify UI elements render correctly.

- [ ] 9. **Update App.tsx routing**
      Modify apps/web/src/App.tsx:
      - Change /room/:roomId route to render <RoomPage /> (waiting room)
      - Add /theatre/:roomId route to render <TheatrePage /> (full playback UI, for later milestones)
      This resolves the routing conflict: /room is waiting room, /theatre is playback.
      Files: apps/web/src/App.tsx
      Verify: `pnpm --filter @matinee/web typecheck` passes. Navigate to /room/:roomId shows RoomPage, /theatre/:roomId shows TheatrePage.

- [ ] 10. **Integration test: Two-peer E2EE room**
      Manual verification with both dev servers running:
      1. Start edge: `pnpm --filter @matinee/edge dev`
      2. Start web: `pnpm --filter @matinee/web dev`
      3. Open http://localhost:5173, click Create Room
      4. Copy invite URL from RoomPage
      5. Open invite URL in incognito/second browser
      6. Verify both tabs show 2 peers in peer list
      7. Verify connection status shows 'ready' in both tabs (E2EE established)
      8. Open browser console in both tabs, verify key exchange messages logged
      9. Close one tab, verify peer list updates to 1 peer in remaining tab
      Files: N/A (manual test)
      Verify: All steps complete successfully. Console logs show E2EE key exchange. Peer list updates correctly.

- [ ] 11. **Write M2 deployment documentation**
      Create docs/M2-DEPLOY.md with:
      - Prerequisites: Cloudflare account (free, no card required per STATE.md condition 4)
      - Setup: wrangler login, create project, configure wrangler.toml (already exists)
      - Deploy command: `pnpm --filter @matinee/edge deploy`
      - Verify Durable Object namespace is created
      - Update web app VITE_EDGE_URL to point to deployed worker
      - Test room creation and WebSocket connection to production
      Files: docs/M2-DEPLOY.md
      Verify: Document is complete and matches Cloudflare free tier constraints from FREE-TIER-LEDGER.md.

---

## Conflicts and Resolutions

**Conflict 1:** App.tsx maps `/room/:roomId` to TheatrePage, but M2 needs a separate waiting room (RoomPage).  
**Resolution:** Change `/room/:roomId` to render RoomPage (waiting room with invite/presence). Add `/theatre/:roomId` for TheatrePage (full playback UI, implemented in M3+). This aligns with user flow: create room → wait for partner (RoomPage) → start watching (TheatrePage).

**Conflict 2:** Protocol types exist but missing presence message types.  
**Resolution:** Extend WSMessageType union and add payload interfaces in step 1. Backward compatible (additive change).

**Conflict 3:** room-do.ts has basic WebSocket relay but no presence broadcasts.  
**Resolution:** Add peer-joined/peer-left broadcasts in step 3. Existing message relay logic remains functional.

---

## Dependencies

- Steps 1-3: Backend infrastructure (independent, can be done in parallel)
- Steps 4-5: E2EE crypto layer (depends on step 1 for protocol types)
- Step 6: RoomClient (depends on steps 4-5 for crypto utilities, step 3 for E2EE relay)
- Steps 7-9: UI pages (depend on step 6 for RoomClient)
- Step 10: Integration test (depends on all previous steps)
- Step 11: Documentation (independent, can be done anytime)

**Recommended order:** 1 → 2 → 3 (backend complete) → 4 → 5 (crypto complete) → 6 (client complete) → 7 → 8 → 9 (UI complete) → 10 (test) → 11 (docs).

---

## Environment Setup Notes

**Development:**
- Terminal 1: `pnpm --filter @matinee/edge dev` (Cloudflare Worker on localhost:8787)
- Terminal 2: `pnpm --filter @matinee/web dev` (Vite on localhost:5173)
- Both must run simultaneously for full stack testing

**Edge worker restart:** Changes to apps/edge require manual restart (no HMR).  
**Web HMR:** Changes to apps/web hot-reload automatically.

**TypeScript verification:** Run `pnpm typecheck` at root to check all packages, or per-package with `pnpm --filter <package> typecheck`.

---

## Acceptance Criteria (per REQUIREMENTS.md)

- ✅ FR-101: Create Room generates unique room ID and shareable URL
- ✅ FR-102: Join Room via URL connects via WebSocket, max 2 peers
- ✅ FR-701: Key Exchange using ECDH during room join, derives AES-GCM-256 key
- ✅ FR-702: Message Encryption ready (infrastructure complete, will be used in M3+)
- ✅ FR-703: No Server Plaintext — worker relays encrypted key-exchange messages only

**Gate A compliance:**
- Cloudflare free tier, no payment card required (condition 4 verified in STATE.md)
- E2EE implemented BEFORE any messaging (per §6 milestone mapping)
- Room expiry (FR-103) and reconnect (FR-104) deferred to M3 for simplicity

---

*End of M2 plan*
