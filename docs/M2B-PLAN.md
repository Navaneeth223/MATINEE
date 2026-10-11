# M2b: Security Fixes and Hardening

**Status:** MUST complete before M3  
**Date:** 2026-10-10  
**Reason:** M2 implementation has critical security gaps that violate requirements

---

## Critical Issues with Current M2

The current M2 implementation is **NOT production-ready** and has these critical flaws:

1. **Unauthenticated ECDH** - Server generates room secret, vulnerable to MITM
2. **No message encryption** - Only handshake encrypted, all other messages plaintext
3. **No access control** - Rooms accept unlimited peers, no host authentication
4. **Wrong expiry** - 30 minutes instead of spec's 12 hours
5. **No security tests** - Tamper/replay attacks untested
6. **Missing features** - No SAS, QR codes, room lock

---

## M2b Must-Fixes (Blocking)

These MUST be fixed before M3 can start:

### 1. Client-Side Secret Generation (§8.3, §10.4)

**Current (WRONG):**
- Server generates roomId
- Unauthenticated ECDH exchange
- No shared secret protecting room

**Required:**
- Client generates 16-byte `roomSecret` using `crypto.getRandomValues()`
- Invite URL built client-side: `{origin}/r/{roomId}#k={base64url(secret)}`
- Server NEVER sees or generates the secret
- After reading fragment, call `history.replaceState()` to strip it from URL
- Derive `K_enc` and `K_auth` from roomSecret using HKDF-SHA-256
- Authenticate ECDH public keys with `K_auth` (HMAC-SHA-256)
- Mix `K_enc` into session key derivation per §11.3

**Files to modify:**
- `apps/web/src/pages/FoyerPage.tsx` - generate secret, build invite URL
- `apps/web/src/pages/RoomPage.tsx` - read fragment, strip with replaceState
- `apps/web/src/lib/crypto.ts` - add HKDF derivation for K_enc/K_auth
- `apps/web/src/lib/room-client.ts` - authenticate ECDH keys with K_auth

### 2. Universal seal()/open() Path (§11.1, §11.3)

**Current (WRONG):**
- Only key-exchange messages encrypted
- sendMessage() encryption "deferred to M3"
- Server sees all message plaintext

**Required:**
- ONE seal()/open() code path for EVERY message type
- Nonce format: `sid || counter` (session ID + monotonic counter)
- AAD (Additional Authenticated Data) includes message type and timestamp
- Replay rejection: track highest seen counter per peer
- Server sees ONLY envelope fields from §11.1:
  - `from` (peer ID)
  - `to` (peer ID or null for broadcast)
  - `nonce` (base64)
  - `ciphertext` (base64)
  - `tag` (base64)
- No plaintext `type`, `payload`, or any content visible to server
- No "deferral to M3" - encryption is M2b requirement

**Protocol types to add:**
```typescript
// Encrypted envelope (server sees this)
interface SealedMessage {
  from: string;          // Sender peer ID
  to: string | null;     // Target peer ID or null for broadcast
  nonce: string;         // base64(sid || counter)
  ciphertext: string;    // base64(encrypted payload)
  tag: string;           // base64(auth tag)
}

// Plaintext inner message (only peers see this after decrypt)
interface InnerMessage {
  type: 'key-exchange' | 'peer-update' | 'sync-command' | 'heartbeat';
  timestamp: number;     // Unix ms
  payload: unknown;      // Type-specific payload
}
```

**Files to modify:**
- `packages/protocol/src/index.ts` - add SealedMessage, InnerMessage types
- `apps/web/src/lib/crypto.ts` - add seal()/open() functions with nonce+AAD
- `apps/web/src/lib/room-client.ts` - wrap ALL messages in seal(), unwrap with open()
- `apps/edge/src/room-do.ts` - relay SealedMessage opaquely, never inspect payload

### 3. Hard 2-Peer Cap + Host Token + Knock/Admit (§12.2)

**Current (WRONG):**
- No peer limit
- No host authentication
- Anyone with room ID can join

**Required:**
- **Hard cap:** Exactly 2 peers per room
- **Host token:** First peer to create room receives `hostToken` = hash of random 32 bytes
- **Room state:** `WAITING` (< 2 peers) | `FULL` (= 2 peers) | `LOCKED` (admin action)
- **Knock/admit flow:**
  - Peer 2 knocks (sends `knock` message with displayName)
  - Peer 1 (host) receives knock notification
  - Peer 1 admits or denies
  - If admitted, peer 2 joins; if denied, connection closed
  - If room full or locked, connection closed immediately with reason
- **Unadmitted sockets:** Receive NOTHING except admission result
- **Third visitor:** Immediate close with "room full" message

**Files to modify:**
- `apps/edge/src/room-do.ts` - add state machine, knock/admit logic, peer cap
- `apps/web/src/lib/room-client.ts` - add knock/admit event handlers
- `apps/web/src/pages/RoomPage.tsx` - show admit/deny UI for host
- `apps/web/src/stores/roomStore.ts` - add hostToken, room state

### 4. Room Expiry: 12 Hours (Spec Compliance)

**Current (WRONG):**
- 30-minute idle expiry

**Required:**
- 12-hour idle expiry per spec
- Heartbeats count as activity (reset timer)
- No expiry while any socket is connected
- Alarm scheduling after last activity

**Files to modify:**
- `apps/edge/src/room-do.ts` - change alarm interval to 12 hours

### 5. Security Tests (MUST)

**Required tests with results saved:**

#### Tamper Test
- Send message, flip one bit in ciphertext
- Verify decrypt fails with authentication error

#### Replay Test
- Capture sealed message
- Replay it 5 seconds later
- Verify recipient rejects (nonce counter too old)

#### Wrong Key Test
- Two rooms with different secrets
- Send message from Room A to Room B
- Verify decrypt fails

#### Nonce Uniqueness Test
- Send 1000 messages in sequence
- Verify no nonce collisions
- Verify monotonic counter increments

#### Playwright E2E Tests
- **E2E-01:** Create room, join with correct secret, verify connection
- **E2E-02:** Third visitor attempts to join, verify "room full" rejection
- **E2E-03:** Join with wrong secret in fragment, verify decrypt fails

**Save results:**
- `docs/tests/security-test-results.md` (manual test results)
- `e2e/security.spec.ts` (Playwright tests)

### 6. Should-Have Features (If Time Allows)

These improve UX but are not blocking:

- **SAS words:** Short Authentication String (6 words from BIP39 list)
- **QR code:** Encode invite URL for camera scan
- **Native share:** WhatsApp/LINE/system share sheet
- **Lock room:** Host can lock room (reject future joins)

If not completed, **log them in STATE.md** as M3 candidates.

**Files to add (if implemented):**
- `apps/web/src/lib/sas.ts` - SAS word generation
- `apps/web/src/components/QRCode.tsx` - QR code display
- `apps/web/src/lib/share.ts` - Native share API wrapper

---

## M2b Workflow Structure

```yaml
steps:
  - name: design-security-protocol
    agent: wf-design
    prompt: |
      Design the complete security protocol for M2b per requirements:
      - Client-side secret generation (§8.3, §10.4)
      - seal()/open() with nonce=sid||counter, AAD, replay rejection (§11.1, §11.3)
      - 2-peer cap, host token, knock/admit/deny (§12.2)
      - 12-hour expiry with heartbeats
      
      Write comprehensive design doc covering:
      - Message flow diagrams
      - Crypto primitives (HKDF, HMAC, AES-GCM)
      - State machines (room state, admission flow)
      - Error handling (tamper, replay, wrong key)
      - Wire format specifications
      
      Save to: docs/design/M2B-SECURITY-PROTOCOL.md

  - name: review-design
    agent: wf-design-reviewer
    prompt: |
      Review docs/design/M2B-SECURITY-PROTOCOL.md against requirements:
      - §8.3, §10.4 (client-side secret)
      - §11.1, §11.3 (seal/open, nonce, AAD)
      - §12.2 (2-peer cap, knock/admit)
      
      Check for:
      - Missing authentication steps
      - Replay attack vectors
      - MITM vulnerabilities
      - Race conditions in admission
      
      Verdict: APPROVED | CHANGES_REQUESTED

  - name: implement-crypto
    agent: wf-coder
    prompt: |
      Implement crypto primitives per approved design:
      1. apps/web/src/lib/crypto.ts:
         - generateRoomSecret() → 16 random bytes
         - deriveKeys(secret) → {K_enc, K_auth} via HKDF-SHA-256
         - authenticatePublicKey(pubKey, K_auth) → HMAC signature
         - seal(message, K_enc, sid, counter, AAD) → SealedMessage
         - open(sealed, K_enc, expected_counter, AAD) → InnerMessage | Error
      
      2. packages/protocol/src/index.ts:
         - Add SealedMessage, InnerMessage types
         - Add admission types (knock, admit, deny)
      
      Build + typecheck before committing.

  - name: implement-client
    agent: wf-coder
    prompt: |
      Implement client-side room flow per approved design:
      1. FoyerPage: generate secret, build invite URL with fragment
      2. RoomPage: read fragment, strip with replaceState
      3. room-client.ts:
         - Wrap ALL outgoing messages with seal()
         - Unwrap ALL incoming messages with open()
         - Track nonce counters per peer
         - Reject replays (counter ≤ last seen)
         - Authenticate ECDH public keys
      4. roomStore: add hostToken, room state
      
      Build + typecheck before committing.

  - name: implement-server
    agent: wf-coder
    prompt: |
      Implement server-side admission + relay per approved design:
      1. room-do.ts:
         - Room states: WAITING | FULL | LOCKED
         - Hard 2-peer cap
         - Knock/admit/deny flow
         - Relay SealedMessage opaquely (no payload inspection)
         - 12-hour expiry alarm
      2. Third visitor: immediate close with "room full"
      3. Unadmitted sockets: receive nothing except admission result
      
      Build + typecheck before committing.

  - name: implement-ui
    agent: wf-coder
    prompt: |
      Implement admission UI per approved design:
      1. RoomPage host view:
         - Show knock notification (peer displayName)
         - Admit button → send admit message
         - Deny button → send deny message
      2. RoomPage guest view:
         - Show "Waiting for host to admit..." spinner
         - Handle admission rejection → show error, close
      3. RoomPage (both):
         - Show "Room full" error if third visitor
         - Show "Room locked" error if locked
      
      i18n strings in all 3 locales.
      Build + typecheck before committing.

  - name: manual-security-tests
    agent: wf-coder
    prompt: |
      Run manual security tests and document results:
      1. Tamper test (flip bit in ciphertext)
      2. Replay test (replay captured message)
      3. Wrong key test (cross-room message)
      4. Nonce uniqueness test (1000 messages)
      
      Save results to: docs/tests/security-test-results.md
      
      Include:
      - Test setup
      - Actual vs expected results
      - Pass/fail verdict
      - Screenshots or logs

  - name: playwright-e2e-tests
    agent: wf-coder
    prompt: |
      Write Playwright E2E tests:
      1. E2E-01: Create room, join with correct secret
      2. E2E-02: Third visitor rejected
      3. E2E-03: Wrong secret in fragment fails
      
      Save to: e2e/security.spec.ts
      
      Run: pnpm --filter @matinee/e2e test
      Verify all tests pass before committing.

  - name: integration-verify
    agent: wf-coder
    prompt: |
      Verify M2b integration end-to-end:
      1. pnpm build (all packages)
      2. pnpm typecheck (all packages)
      3. Start dev servers (web + edge)
      4. Manual test: create room, copy invite URL with fragment
      5. Open in second browser, verify knock/admit flow
      6. Send test message, verify encrypted on wire
      7. Network inspector: verify server sees only SealedMessage
      
      Document test results in commit message.

  - name: final-review
    agent: semantic_reviewer
    prompt: |
      Final security review of M2b implementation:
      - Client-side secret generation verified
      - seal()/open() used for ALL messages
      - 2-peer cap + knock/admit working
      - 12-hour expiry implemented
      - Security tests pass (manual + E2E)
      - Server sees NO plaintext
      
      Review artifacts:
      - docs/design/M2B-SECURITY-PROTOCOL.md
      - docs/tests/security-test-results.md
      - e2e/security.spec.ts results
      
      Verdict file: .agents/tasks/m2b-security/verdict.json
```

---

## Acceptance Criteria

M2b is complete when:

1. ✅ Client generates 16-byte roomSecret
2. ✅ Invite URL contains fragment: `#k={base64url(secret)}`
3. ✅ Fragment stripped with history.replaceState()
4. ✅ K_enc and K_auth derived via HKDF
5. ✅ ECDH public keys authenticated with K_auth
6. ✅ ALL messages wrapped with seal() using nonce=sid||counter + AAD
7. ✅ Server sees ONLY SealedMessage envelopes (no plaintext)
8. ✅ Replay messages rejected (counter check)
9. ✅ Tamper test fails decrypt (authentication)
10. ✅ Wrong key test fails decrypt
11. ✅ 2-peer hard cap enforced
12. ✅ Third visitor immediately rejected
13. ✅ Knock/admit/deny flow working
14. ✅ Host token authentication working
15. ✅ 12-hour idle expiry implemented
16. ✅ All Playwright E2E tests pass
17. ✅ Independent review verdict: APPROVED

---

## Design Questions for Owner

These require owner decision (do NOT decide yourself):

1. **SAS format:** 6 BIP39 words or 6-digit PIN?
2. **Knock timeout:** Auto-deny after how many seconds?
3. **Room lock:** Permanent or temporary until next disconnect?
4. **Heartbeat interval:** Every 30s, 60s, or 120s?

---

## ADRs to Record

Every design decision must be documented:

- ADR-00X: Client-side secret generation rationale
- ADR-00Y: Nonce format (sid||counter) choice
- ADR-00Z: HMAC vs. mixed ECDH authentication
- ADR-0XX: Knock/admit timeout value
- ADR-0XY: 12-hour vs. "connected" expiry logic

---

## Current M2 Code to Remove/Replace

These files have security flaws and must be rewritten:

- `apps/web/src/lib/crypto.ts` - missing K_enc/K_auth derivation, no seal/open
- `apps/web/src/lib/room-client.ts` - unauthenticated ECDH, no universal encryption
- `apps/edge/src/room-do.ts` - no admission control, wrong expiry, sees plaintext
- `apps/web/src/pages/FoyerPage.tsx` - server generates secret (wrong)
- `apps/web/src/pages/RoomPage.tsx` - no fragment reading/stripping

Do NOT call current M2 "working" or "production-ready" - it has critical security gaps.

---

## Timeline Estimate

- Design + review: 3-4 hours
- Crypto implementation: 2-3 hours
- Client implementation: 3-4 hours
- Server implementation: 2-3 hours
- UI implementation: 2 hours
- Security tests: 2-3 hours
- E2E tests: 2 hours
- Integration + review: 2 hours

**Total: ~20-25 hours of agent work**

---

**Status:** Ready to start workflow after owner confirms design questions.
