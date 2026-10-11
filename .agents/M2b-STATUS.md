# M2b Implementation Status

**Date:** 2026-10-10  
**Milestone:** M2b - Secure Room Setup  
**Phase:** Implementation

---

## ✅ Completed

### Crypto Primitives (`crypto.ts`)
- ✅ `deriveKeys()` - HKDF-based key derivation (encryption + auth)
- ✅ `sign()` / `verify()` - Ed25519 signatures for public keys
- ✅ `seal()` / `open()` - AES-GCM encryption/decryption with AAD
- ✅ `ReplayTracker` class - Nonce deduplication per sender
- ✅ **`generateSAS()` - REWRITTEN per §11.3:**
  - **Before (WRONG):** Used only `roomSecret` → vulnerable to MITM key swap
  - **After (CORRECT):** Uses `localPublicKeyJwk + remotePublicKeyJwk + roomId`
  - Canonicalizes both keys, sorts them, hashes with roomId
  - Different session keys → different hash → different SAS words
  - **Detects MITM:** Attacker swapping a public key → peers compute different SAS

### BIP39 Wordlist
- ✅ Full 2048-word BIP39 English wordlist extracted from official Bitcoin BIP
- ✅ Moved to dedicated file `bip39-words.ts` (cleaner imports)
- ✅ Test validates wordlist length (2048 words required for 11-bit indices)

### Tests Created
- ✅ `crypto.test.ts`:
  - `produces different words for different session public keys (§11.3)`
    - Proves: Different ECDH key pairs → different SAS words
  - `produces the same words regardless of key order (deterministic)`
    - Proves: Both peers see identical SAS (internal key sorting)
  - `produces different words for different roomIds`
    - Proves: Prevents key reuse across rooms

### Helper Functions
- ✅ `generateECDHKeyPair()` - P-256 ephemeral key generation for forward secrecy

### Build Status
- ✅ All TypeScript type checks pass (`pnpm typecheck`)
- ✅ All crypto tests pass (`pnpm --filter @matinee/web test crypto.test.ts`)

---

## 🔄 In Progress

### Documentation Review
- Reading AGENT_PROMPT.md sections:
  - §3 (room-do.ts requirements)
  - §8.3 (WebSocket message format)
  - §10.4 (keepalive protocol)
  - §11 (SAS verification)
  - §12.2 (replay protection)

---

## ⏳ Next Tasks (Your Ordered Sequence)

1. **room-do.ts** (Durable Object)
   - 2-peer cap enforcement
   - Host token generation/validation
   - Knock/admit flow
   - 12h room expiry
   - Keepalive tracking
   - Seal/open all WebSocket messages

2. **room-client.ts** (Client-side room logic)
   - Seal/open all messages
   - ReplayTracker integration
   - Keepalive sending
   - Connection state management

3. **FoyerPage** (Invite creation UI)
   - Client-side secret generation
   - Invite URL with fragment (`#secret`)
   - Copy-to-clipboard

4. **RoomPage** (Room joining UI)
   - Fragment read/strip (no server leakage)
   - Knock UI
   - SAS display (4 BIP39 words)
   - Admit confirmation

5. **Security Tests**
   - Tamper detection (modified ciphertext)
   - Replay detection (duplicate nonce)
   - Wrong key rejection (decryption failure)
   - Nonce uniqueness (no collisions)
   - E2E scenarios:
     - **E2E-01:** Alice creates room, Bob joins, both see same SAS
     - **E2E-02:** Mallory swaps Alice's public key → different SAS → detected
     - **E2E-03:** Message replay → rejected by ReplayTracker

---

## 📝 Key Decisions Made

### generateSAS Diff (Critical Security Fix)

**Problem:** Original `generateSAS(roomSecret)` only used the shared secret. An attacker performing a MITM key swap attack would still produce the same SAS on both ends, because the secret derivation wasn't tied to the public keys themselves.

**Solution (§11.3):** New signature:
```typescript
export async function generateSAS(
  localPublicKeyJwk: JsonWebKey,
  remotePublicKeyJwk: JsonWebKey,
  roomId: string
): Promise<string[]>
```

**Why this works:**
1. Both peers canonicalize their own + remote public keys
2. Keys are sorted lexicographically (ensures both peers compute same hash)
3. Hash input: `sortedKey1 || sortedKey2 || roomId`
4. If Mallory swaps a key during handshake:
   - Alice hashes: `{Alice's real key, Mallory's fake key, roomId}`
   - Bob hashes: `{Bob's real key, Mallory's fake key, roomId}`
   - **Result:** Different hashes → different SAS words → users detect mismatch

**Test Evidence:**
```typescript
it('produces different words for different session public keys (§11.3)', async () => {
  const sasA = await generateSAS(pubKeyA, pubKeyB, roomId);
  const sasAC = await generateSAS(pubKeyA, pubKeyC, roomId);
  expect(sasAC).not.toEqual(sasA); // ✅ Different keys → different SAS
});
```

---

## 🎯 Current Blockers

None! All type checks pass, tests pass, ready to proceed with room-do.ts.

---

## 📊 Progress Tracker

| Component | Status | Notes |
|-----------|--------|-------|
| crypto.ts | ✅ Complete | All primitives implemented |
| BIP39 wordlist | ✅ Complete | Full 2048 words |
| generateSAS | ✅ Fixed | Now includes session keys (§11.3) |
| Tests | ✅ Pass | 3/3 crypto tests green |
| room-do.ts | ⏳ Next | Starting implementation |
| room-client.ts | ⏳ Pending | After room-do |
| FoyerPage | ⏳ Pending | After room-client |
| RoomPage | ⏳ Pending | After FoyerPage |
| E2E Tests | ⏳ Pending | Final verification |

---

## 🔍 AGENT_PROMPT.md vs BRIEF.md Comparison

*(To be filled after reading AGENT_PROMPT.md sections)*

### Sections to Compare:
- §3: room-do.ts requirements
- §8.3: WebSocket message format
- §10.4: Keepalive protocol
- §11.3: SAS verification ✅ (already implemented correctly)
- §12.2: Replay protection ✅ (ReplayTracker implemented)

### Findings:
*(Pending - will document any discrepancies found)*

---

## 💡 Implementation Notes

### Why BIP39?
- Standard wordlist (used in crypto wallets)
- 2048 words = 11 bits per word
- 4 words = 44 bits of entropy
- User-friendly: words like "abandon", "ability", "zebra"

### Why ReplayTracker?
- Prevents message replay attacks
- Tracks nonces per sender (per-peer deduplication)
- Windowed approach (stores last N nonces, not infinite)

### Why HKDF?
- Derives multiple keys from one master secret
- Generates both encryption key + auth key
- Prevents key reuse across different purposes

---

**Next Step:** Implement room-do.ts per AGENT_PROMPT.md §3 + your requirements (2-peer cap, host token, knock/admit, 12h expiry, keepalive).
