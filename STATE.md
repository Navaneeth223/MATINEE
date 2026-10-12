# Matinee Project State

**Last updated:** 2026-10-10  
**Current milestone:** M2b (Security fixes and hardening) — 🔴 IN PROGRESS  
**Gate A:** APPROVED with conditions  
**M2 status:** NOT COMPLETE - critical security gaps found

**📖 Session Start:** At the start of every session read `docs/BRIEF.md` and `STATE.md`; open the relevant AGENT_PROMPT.md sections.

## Owner Answers
- **Partner browser:** Safari (assumed)
- **My upload speed:** ___ Mbps (TBD)

## Gate A Conditions
1. ✅ Spikes S5+S1 scheduled before M3 start (captureStream + two-network WebRTC test)
2. ✅ Spikes S6 scheduled before M6
3. ✅ Spikes S2+S3 scheduled before M7
4. ✅ All spikes must run in claimed environment (Chrome/Playwright, not Node.js)
5. ✅ Metered quote corrected — see docs/FREE-TIER-LEDGER.md (condition 2)
6. ✅ FLEURS search documented — see docs/spikes/FLEURS-SEARCH.md (condition 3)
7. ✅ Cloudflare free-account check documented — see docs/M2-CLOUDFLARE-SETUP.md (condition 4)

## Milestone Status
- **M1:** Foundation ✅ DONE (scaffolding complete)
- **M2:** Rooms + E2EE + presence + invite ❌ NOT COMPLETE (critical security gaps)
- **M2b:** Security fixes and hardening 🔴 IN PROGRESS (MUST fix before M3)
- **M3:** From Me core + remote control ⏳ BLOCKED (waiting for M2b completion)

## M2 Critical Security Issues (Must-Fix in M2b)

1. **Unauthenticated ECDH** - Server generates room secret (wrong); vulnerable to MITM
2. **No message encryption** - Only handshake encrypted; all other messages plaintext visible to server
3. **No access control** - Unlimited peers, no host authentication, no knock/admit
4. **Wrong expiry** - 30 minutes instead of spec's 12 hours
5. **No security tests** - Tamper/replay/wrong-key attacks untested
6. **Missing Should-haves** - No SAS words, QR codes, room lock

**Blocking M3:** These MUST be fixed before M3 can start. See docs/M2B-PLAN.md for details.
- **M4:** Theatre UI + Mixer + face bubbles ⏳ PENDING
- **M5:** Voice/video + companion device + Doctor ⏳ PENDING
- **M6:** Subtitles v1 ⏳ PENDING (spike S6 first)
- **M7:** Subtitle generation EN/TH/ML ⏳ PENDING (spikes S2+S3 first)
- **M8:** Together mode ⏳ PENDING
- **M9:** Share Screen + VLC fallback ⏳ PENDING
- **M10:** Mobile/PWA polish ⏳ PENDING
- **M11:** Security hardening ⏳ PENDING
- **M12:** Release ⏳ PENDING

## Spike Schedule
| Spike | Scheduled | Environment | Status |
|-------|-----------|-------------|--------|
| S1    | Start of M3 | Real Chrome, two networks | BLOCKED — awaiting M3 |
| S2    | Before M7   | Real Chrome + Playwright  | BLOCKED — awaiting M7 |
| S3    | Before M7   | Real Chrome + Playwright  | BLOCKED — awaiting M7 |
| S4    | TBD         | —                         | BLOCKED (design decision) |
| S5    | Start of M3 | Real Chrome, captureStream| BLOCKED — awaiting M3 |
| S6    | Before M6   | Real Chrome               | BLOCKED — awaiting M6 |
| S7    | Done        | Node.js (valid for intent)| DONE |
| S8    | TBD         | —                         | BLOCKED |
| S10   | M3 prep     | Manual: VLC + Windows vol | READY (html written) |

## Relay Fallback Ladder
1. Direct P2P (STUN only)
2. Different-network test
3. Together mode (both have the file, no relay needed for sync/chat)
4. Owner's call: add card for Cloudflare Realtime TURN (1,000 GB/month)

## Notes
- CR-001 and CR-002 applied; REQUIREMENTS.md updated accordingly.
- Roles are symmetric: either person can be source.
- Watch-along mode added as M8 candidate (no DRM bypass, no capture).
- Netflix sync extension: v1.1 candidate only, not v1 requirement.


---

## 2026-10-10 21:05 UTC - M2b Crypto Implementation (CORRECTION)

**CORRECTION:** Earlier agent claims that "tests pass" were **WRONG**. No test runner was installed initially. Tests claimed to pass but nothing ran.

- Installed vitest@5.0.3 as devDependency in apps/web
- Created crypto.test.ts with proper tests
- **Fixed critical bugs:**
  1. generateSAS was using JWK/JSON (property-order dependent) → now uses `exportKey('raw')` 
  2. signPublicKey/verifyPublicKey were using JWK/JSON → now use `exportKey('raw')`
  3. Added test proving same key with different JWK property order gives same signature/SAS

**Actual test results (2026-10-10 21:04:32):**
```
Test Files  1 passed (1)
     Tests  5 passed (5)
Duration  1.74s

✓ produces different words for different session public keys 28ms
✓ produces the same words regardless of key order (deterministic) 2ms  
✓ produces different words for different roomIds 1ms
✓ uses raw key bytes (property order independent) 2ms
✓ signPublicKey uses raw key bytes (property order independent) 8ms
```

**Why raw bytes matter:** JWK property order varies between `crypto.subtle.exportKey()` calls. Two exports of the same key can produce `{"x":"...","y":"..."}` or `{"y":"...","x":"..."}`. Hashing JSON would give different results. Raw bytes are canonical.
