# M2b Security Hardening Implementation Plan

**Task:** M2b Must-fixes (blocking M3)  
**Spec:** docs/BRIEF.md §14 (5 Must-fixes), §8.3 (room creation), §10.4 (join flow), §11.3 (E2EE spec), §12.2 (admission control)  
**ADRs Applied:** ADR-001 (SAS 4 words), ADR-002 (knock 120s), ADR-003 (room lock), ADR-004 (keepalive 30s), ADR-005 (M2b scope)

---

## Implementation Order

Work proceeds in 4 sequential features. Each feature is independently verifiable and leaves the codebase buildable.

1. **FEAT-001**: Protocol types + crypto primitives (foundation layer)
2. **FEAT-002**: Client-side secret + universal seal/open + SAS (client layer)
3. **FEAT-003**: Server admission control + 2-peer cap + 12h expiry (server layer)
4. **FEAT-004**: Security tests (verification layer)

---

## FEAT-001: Protocol Types + Crypto Primitives

**What:** Add SealedMessage wire format, HKDF key derivation, HMAC signing, seal/open functions, replay tracking.

**Why first:** All other features depend on these types and crypto functions. No UI or server changes yet.

**Files:**
- `packages/protocol/src/index.ts` — Add SealedMessage, AAD, SignedPublicKey types
- `apps/web/src/lib/crypto.ts` — Add deriveRoomKeys, signPublicKey, verifyPublicKey, mixSessionKey, seal, open, ReplayTracker

**Verification:**
```bash
cd packages/protocol && pnpm run typecheck  # No errors
cd packages/protocol && pnpm build          # dist/ generated
cd apps/web && pnpm run typecheck           # No errors
```

---

## FEAT-002: Client-Side Secret + Universal Seal/Open + SAS

**What:** FoyerPage generates roomSecret client-side, builds /r/:roomId#k=... invite URL. RoomPage reads fragment, derives K_enc/K_auth, strips fragment from history. RoomClient seals ALL messages with nonce=sessionId||counter, signs ECDH public keys, mixes K_enc into session key. SAS 4 words displayed after key exchange.

**Why second:** Implements client-side E2EE (Laws 3, 4, 8). Server changes come next.

**Files:**
- `apps/web/src/App.tsx` — Change route from /room/:roomId to /r/:roomId
- `apps/web/src/pages/FoyerPage.tsx` — Generate roomSecret, build #k= URL
- `apps/web/src/pages/RoomPage.tsx` — Extract fragment, derive keys, display SAS
- `apps/web/src/lib/room-client.ts` — Universal seal/open, signed key exchange, replay tracking
- `apps/web/src/lib/crypto.ts` — Add deriveSAS function
- `docs/adr/ADR-006-client-side-secret-generation.md` — Record decision

**Verification:**
```bash
cd apps/web && pnpm run typecheck  # No errors
pnpm dev                           # Dev server starts
# Manual: create room, copy invite (has #k=...), open in incognito, both show same SAS
```

---

## FEAT-003: Server Admission Control + 2-Peer Cap + 12h Expiry

**What:** Durable Object hard-caps at 2 peers, generates hostToken for first peer, queues unadmitted sockets (receives nothing until admitted), enforces knock timeout (120s), supports room lock toggle from host, uses 12-hour alarm with hibernation auto-response for keepalives.

**Why third:** Implements server-side security (Laws 5, 6, 7). Depends on client seal/open from FEAT-002.

**Files:**
- `packages/protocol/src/index.ts` — Add RoomState, AdmittedPeer types, message types (knock, admit, deny, admitted, lock, unlock, keepalive, error)
- `apps/edge/src/room-do.ts` — 2-peer cap, host token, knock/admit flow, room lock, 12h expiry, hibernation keepalives
- `apps/web/src/lib/room-client.ts` — Send knock, keepalive interval (30s), admit/deny/lock/unlock methods
- `apps/web/src/pages/RoomPage.tsx` — Knock modal (Admit/Deny buttons), Lock Room toggle, locked badge
- `docs/adr/ADR-007-admission-control-implementation.md` — Record decision

**Verification:**
```bash
cd apps/edge && pnpm run typecheck   # No errors
cd apps/edge && pnpm run build       # Builds successfully
pnpm dev                             # Both edge and web dev servers start
# Manual: 3 windows, window 3 rejected with room_full, window 1 admits window 2
```

---

## FEAT-004: Security Tests

**What:** Vitest unit tests for crypto primitives (tamper, replay, wrong key, nonce uniqueness). Playwright E2E tests (correct secret join, third visitor rejected, wrong secret decrypt fail).

**Why last:** Tests the complete implementation from FEAT-001/002/003. Cannot test before features exist.

**Files:**
- `packages/protocol/vitest.config.ts` — Vitest config
- `packages/protocol/package.json` — Add vitest devDep + test script
- `packages/protocol/src/__tests__/crypto.test.ts` — 7 unit tests
- `playwright.config.ts` — Playwright config at root
- `e2e/security.spec.ts` — 3 E2E tests
- `package.json` (root) — Add test:e2e and test scripts
- `docs/tests/security-test-results.md` — Saved passing output
- `docs/adr/ADR-008-security-test-strategy.md` — Record decision

**Verification:**
```bash
cd packages/protocol && pnpm test   # 7 vitest tests pass
pnpm test:e2e                       # 3 Playwright tests pass
pnpm test                           # Runs both, all pass
cat docs/tests/security-test-results.md  # Contains timestamped output
```

---

## Cross-FEAT Integration (Convergence Loop)

After all 4 FEATs complete, run full integration verification:

1. **Build all packages:**
   ```bash
   pnpm build  # Builds protocol, web, edge
   ```

2. **Run all tests:**
   ```bash
   pnpm test   # Vitest + Playwright
   ```

3. **Manual smoke test:**
   - `pnpm dev` — Start dev servers
   - Create room in window 1 (receives hostToken)
   - Copy invite URL (contains #k=secret)
   - Open in incognito window 2, paste invite
   - Window 2 knocks, window 1 admits
   - Both windows show 'ready' status, same SAS words, 2 peers
   - Send chat message, verify encrypted in network tab
   - Open window 3, attempt join, rejected with room_full
   - Window 1 locks room, attempt window 4, rejected with room_locked

4. **Verify Laws compliance:**
   - Law 3: roomSecret generated client-side ✓
   - Law 4: ALL messages sealed (check RoomClient.sendMessage) ✓
   - Law 5: Third peer rejected ✓
   - Law 6: Host token, knock/admit enforced ✓
   - Law 7: 12h expiry alarm scheduled ✓
   - Law 8: ReplayTracker rejects duplicates ✓

---

## Must-Fix Checklist (§14)

- [x] **MF-1: Client-side secret** (§8.3, §10.4) — FEAT-002
- [x] **MF-2: Universal seal/open()** (§11.3) — FEAT-001 + FEAT-002
- [x] **MF-3: 2-peer cap + host token + knock/admit** (§12.2) — FEAT-003
- [x] **MF-4: 12-hour expiry** (§7) — FEAT-003
- [x] **MF-5: Security tests** — FEAT-004

**Should-haves in M2b (ADR-005):**
- [x] SAS words — FEAT-002
- [x] Room lock — FEAT-003

**Deferred to M4 (ADR-005):**
- [ ] QR code invite
- [ ] WhatsApp/LINE/native share

---

## ADRs to Record

- **ADR-006**: Client-side secret generation with URL fragment (FEAT-002)
- **ADR-007**: Admission control implementation (FEAT-003)
- **ADR-008**: Security test strategy (FEAT-004)

---

## Blocking Issues / Risks

**None identified.** All dependencies are in place:
- TypeScript 5.9.3, pnpm workspaces, turbo configured
- Playwright 1.64.0 installed (root package.json devDependencies)
- Web Crypto API available in browser and Cloudflare Workers
- BIP39 wordlist can be hardcoded or imported from npm package

**If npm bip39 unavailable:** Hardcode minimal 2048-word array in crypto.ts (acceptable for M2b, refactor in M11).

---

## Final Deliverable

After convergence loop passes:
- All TypeScript typechecks pass (`pnpm run typecheck`)
- All builds succeed (`pnpm build`)
- All tests pass (`pnpm test`)
- Manual smoke test completes all scenarios
- docs/tests/security-test-results.md contains evidence
- 3 new ADRs recorded in docs/adr/
- STATE.md updated: M2b status = DONE, M3 unblocked

**Report format (§2.3 of BRIEF.md):**
```
## M2b Security Hardening: COMPLETE

**Completed:**
- FEAT-001: Protocol types + crypto primitives
- FEAT-002: Client-side secret + universal seal/open + SAS
- FEAT-003: Server admission control + 2-peer cap + 12h expiry
- FEAT-004: Security tests (vitest + Playwright)

**Files Modified:** [list]

**Tests:**
- Unit (vitest): 7/7 PASS
- E2E (Playwright): 3/3 PASS

**Verdict:** APPROVED (all 5 Must-fixes complete, Laws 3-8 enforced)

**Next:** M3 (From Me core + remote control) unblocked
```

---

**End of Plan**

