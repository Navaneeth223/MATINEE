# Matinee Project Brief

**Version:** 0.3 (Post-CR-001/CR-002, M2b security fixes)  
**Last Updated:** 2026-10-10  
**Required Reading:** Start every session by reading this file and STATE.md

---

## §1: Project Overview

**Mission:** Two people in different countries watch the same film together in perfect sync.

**Primary Mode:** Mode B (From Me) — Owner streams video from their device to partner's MacBook. No server upload. No file storage. Partner has full remote control (play/pause/seek).

**Users:**
- **Owner:** Windows laptop/PC + VLC or browser, has the film file
- **Partner:** MacBook (Safari or Chrome), likely does NOT have the film

**Core Promise:**
- Film streams peer-to-peer (WebRTC), never uploads to server
- Subtitles generated locally (Whisper) and translated (Gemini BYOK)
- Zero cost to start: all infrastructure on free tiers (no card until M5)
- End-to-end encrypted: server never sees plaintext

---

## §2: Change Requests Applied

### CR-001 (2026-10-10)
1. Mode B (From Me) is PRIMARY mode (M3)
2. Partner likely does NOT have film file
3. Remote control for partner in Mode B
4. Audio mixer with independent volume branches
5. Voice clarity (mic/speaker picker, Opus mono 32-48 kbps)
6. Draggable+resizable face bubbles with snap-to-corners
7. Companion device (laptop camera+mic while PC sends movie)
8. Cinema+ quality preset with upload speed detection
9. Mode C (VLC screen share) as fallback with limitations

### CR-002 (2026-10-10)
1. **Symmetric roles:** Either person can be source (sender)
2. **Watch-along mode:** Netflix with voice/video overlay (M8/M9)
   - Each person plays their own subscription independently
   - Shared 3-2-1 countdown start
   - Pause-together alert (no enforcement)
   - NO DRM bypass, NO capture, NO relay of streaming content
3. **Netflix extension:** v1.1 candidate only (not v1 requirement)

---

## §2.3: Reporting Format

When reporting workflow status or completion, use this format:

```
## [Task Name]: [Status]

**Completed:**
- [Feature 1] - [Brief description]
- [Feature 2] - [Brief description]

**Files Modified:**
- path/to/file1 - [Changes]
- path/to/file2 - [Changes]

**Tests:**
- [Test type]: [Pass/Fail]
- [Test type]: [Pass/Fail]

**Verdict:** [APPROVED | CHANGES_REQUESTED | BLOCKED]

**Next:** [What needs to happen next]
```

---

## §3: The 12 Laws (Inviolable)

1. **No server-side plaintext:** Server NEVER sees film bytes, sync commands, subtitles, or any content in plaintext. E2EE is mandatory.

2. **No credit card until M5:** M1-M4 operate with ZERO payment card requirements. If any service asks for a card, STOP and report (§6.3).

3. **Client-side secret generation:** Room secret (16 bytes) generated CLIENT-SIDE. Server NEVER sees or generates the secret.

4. **Universal encryption:** ONE seal()/open() code path for EVERY message type. No plaintext messages after key exchange. No "deferred to M3" exceptions.

5. **2-peer hard cap:** Exactly 2 peers per room (max). Third visitor immediately rejected with "room full".

6. **Host authentication:** First peer receives host token. Second peer must knock and be admitted. Unadmitted sockets receive NOTHING.

7. **12-hour expiry:** Rooms expire after 12 hours of inactivity (not 30 minutes). Heartbeats count as activity. No expiry while sockets connected.

8. **Replay rejection:** Messages with nonce counter ≤ last seen from that peer are rejected. Strict monotonic counter enforcement.

9. **No DRM bypass:** Watch-along mode does NOT capture, relay, or synchronize streaming service video. Each person plays their own subscription.

10. **Symmetric roles (CR-002):** Either peer may be sender/receiver. Role choice at session start. Safari cannot send (codec limitation).

11. **Partner remote control (CR-001):** In Mode B, partner MUST be able to play/pause/seek. Owner's player executes commands.

12. **Free-tier first:** Choose free-tier options over paid. Document every service's free limits in FREE-TIER-LEDGER.md.

---

## §6.3: Stop-the-Line Conditions

If ANY of these occur, STOP work and report to owner:

1. **Credit card required** for any M1-M4 service
2. **Security vulnerability** found (MITM, replay, tampering possible)
3. **Law violation** discovered in existing code
4. **Spec ambiguity** affecting Must requirements
5. **Test failure** on Must-have acceptance criteria
6. **Free-tier limit** approached (>80% of quota)

**Format:** "🚨 STOP-THE-LINE: [Condition] - [Details] - [Recommendation]"

---

## §8.3: Room Creation Rules

1. Client generates 16-byte `roomSecret` using `crypto.getRandomValues()`
2. POST /api/rooms (server generates UUID roomId only)
3. Client builds invite URL: `{origin}/r/{roomId}#k={base64url(roomSecret)}`
4. Server stores: `roomId`, `hostToken` (hash of random 32 bytes), `state` (WAITING)
5. Server NEVER sees or stores the secret

---

## §10.4: Room Join Rules

1. Guest reads fragment: `window.location.hash` → extract `k` parameter
2. Call `history.replaceState({}, '', window.location.pathname)` to strip fragment
3. Derive `K_enc` and `K_auth` from roomSecret using HKDF-SHA-256:
   - `K_enc` (32 bytes): AES-GCM-256 encryption key
   - `K_auth` (32 bytes): HMAC-SHA-256 authentication key
4. Connect WebSocket with peerId and displayName (NO secret sent)
5. Send `knock` message (encrypted)
6. Wait for host `admit` or `deny`
7. If admitted, proceed with ECDH key exchange
8. Authenticate peer's ECDH public key with `K_auth` (HMAC signature)

---

## §11.3: E2EE Specification

### Key Derivation

```
roomSecret (16 bytes random) 
  → HKDF-SHA-256(salt="matinee-room", info="enc") → K_enc (32 bytes)
  → HKDF-SHA-256(salt="matinee-room", info="auth") → K_auth (32 bytes)
```

### ECDH Key Exchange

1. Each peer generates ECDH P-256 key pair
2. Export public key to JWK format
3. Sign public key: `sig = HMAC-SHA-256(K_auth, pubKey_jwk_json)`
4. Broadcast `key-exchange` message (sealed): `{pubKey, sig}`
5. On receive: verify signature, import pubKey, derive shared secret
6. Mix K_enc into session key: `session_key = HKDF(ecdh_secret || K_enc)`

### seal()/open() for ALL Messages

**Nonce:** `sid || counter` (session ID + monotonic counter, 12 bytes total)
- `sid`: 4-byte session identifier (random at connect)
- `counter`: 8-byte big-endian counter (starts at 0, increments per message)

**AAD (Additional Authenticated Data):**
```json
{
  "from": "peer_id",
  "to": "peer_id_or_null",
  "type": "message_type",
  "timestamp": 1234567890123
}
```

**Wire Format (SealedMessage):**
```json
{
  "from": "peer_id",
  "to": "peer_id_or_null",
  "nonce": "base64(sid || counter)",
  "ciphertext": "base64(encrypted_payload)",
  "tag": "base64(gcm_auth_tag)"
}
```

**Replay Rejection:**
- Track highest seen counter per peer
- Reject if `incoming_counter <= last_seen_counter`
- Reject if counter gap > 1000 (possible attack or clock skew)

**SAS (Short Authentication String):**
- Derive 4 words from roomSecret using BIP39-style wordlist (2048 words)
- Display on both screens after key exchange
- Users verbally confirm words match (MITM detection)

---

## §12.2: Admission Control

**Room States:**
- `WAITING`: 0-1 peers connected
- `FULL`: 2 peers connected
- `LOCKED`: Host locked room (reject all new connections)

**Host Token:**
- First peer to create room receives `hostToken` = `sha256(random_32_bytes)`
- Host can admit/deny knocks
- Host can lock/unlock room

**Knock Flow:**
1. Guest connects → sends `knock` message with displayName
2. Host sees notification with guest name
3. Host clicks Admit or Deny (120s timeout)
4. If timeout, auto-deny + show "Knock again" button
5. If denied, guest connection closed with reason
6. If admitted, guest receives `admitted` message → proceed with key exchange

**Third Visitor:**
- Immediate close with `{type: 'error', reason: 'room_full'}`
- No messages relayed to/from third socket

**Unadmitted Sockets:**
- Receive NOTHING except admission result
- Cannot see peer list, cannot send messages
- Timeout after 120s → auto-deny

---

## §13: Milestone Order (M1-M12)

| Milestone | Goal | Status | Key Deliverables |
|-----------|------|--------|-----------------|
| **M1** | Foundation | ✅ DONE | Monorepo, TypeScript, build tools |
| **M2** | Rooms + E2EE + Presence + Invite | ❌ FAILED | Critical security gaps found |
| **M2b** | Security Fixes | 🔴 IN PROGRESS | Client-side secret, seal/open, admission control, 12h expiry, tests |
| **M3** | From Me Core + Remote Control | ⏳ BLOCKED | WebRTC video, remote control, Cinema+ |
| **M4** | Theatre UI + Mixer + Face Bubbles | ⏳ PENDING | Audio mixer, draggable bubbles |
| **M5** | Voice/Video + Companion + Doctor | ⏳ PENDING | Voice clarity, companion device, TURN decision |
| **M6** | Subtitles v1 | ⏳ PENDING | Load/display SRT/VTT files |
| **M7** | Subtitle Generation | ⏳ PENDING | Whisper EN/TH/ML generation |
| **M8** | Together Mode | ⏳ PENDING | Both-have-file sync |
| **M9** | Share Screen + VLC Fallback | ⏳ PENDING | Mode C screen share |
| **M10** | Mobile/PWA Polish | ⏳ PENDING | Safari Add to Dock, responsive |
| **M11** | Security Hardening | ⏳ PENDING | Penetration review, audit |
| **M12** | Release | ⏳ PENDING | Final QA, docs, launch |

**Current:** M2b in progress. M3 BLOCKED until M2b complete and reviewed.

---

## §14: M2b Must-Fixes (Blocking M3)

1. ✅ **Client-side secret generation** (§8.3, §10.4)
2. ✅ **Universal seal()/open() path** (§11.3)
3. ✅ **2-peer cap + host token + knock/admit** (§12.2)
4. ✅ **12-hour expiry** (§7, not 30 minutes)
5. ✅ **Security tests** (tamper, replay, wrong key, nonce uniqueness, E2E)
6. 🔄 **Should-haves in M2b:** SAS words, room lock
7. ✅ **Independent review** with verdict (must run again)

**Deferred to M4:** QR code, WhatsApp/LINE/native share

---

## §15: ADR Recording Rule

Every design decision MUST be recorded as an ADR in `docs/adr/`:

**Format:** `ADR-NNN-title-slug.md`

**Template:**
```markdown
# ADR-NNN: [Title]

**Date:** YYYY-MM-DD  
**Status:** Accepted | Superseded | Deprecated  
**Deciders:** [Owner | Agent | Both]

## Context
[What decision needs to be made and why]

## Decision
[What was decided]

## Consequences
[What this enables, what it prevents, tradeoffs]

## Alternatives Considered
[Other options and why they were rejected]
```

---

## §16: Session Start Checklist

At the start of EVERY session:

1. ✅ Read `docs/BRIEF.md` (this file)
2. ✅ Read `STATE.md` (current milestone status)
3. ✅ Open relevant `AGENT_PROMPT.md` sections if needed
4. ✅ Check for blocking issues in STATE.md
5. ✅ Review recent commits: `git log --oneline -5`

---

## §17: Critical Files

- `STATE.md` - Current milestone status, blocking issues
- `docs/BRIEF.md` - This file (Laws, rules, E2EE spec)
- `docs/REQUIREMENTS.md` - Full functional requirements
- `docs/FREE-TIER-LEDGER.md` - Service quotas and limits
- `docs/M2B-PLAN.md` - M2b remediation plan
- `docs/DEPLOYMENT-GUIDE.md` - Cloudflare deployment steps
- `docs/adr/` - Architectural decision records

---

**End of BRIEF.md** (150 lines)
