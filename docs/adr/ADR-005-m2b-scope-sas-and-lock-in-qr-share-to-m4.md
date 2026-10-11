# ADR-005: M2b Scope - SAS + Lock In, QR/Share to M4

**Date:** 2026-10-10  
**Status:** Accepted  
**Deciders:** Owner  
**Milestone:** M2b

## Context

M2b Must-fixes require several features. Owner needs to decide which are blocking vs. nice-to-have:
- SAS words (security verification)
- Room lock (access control)
- QR code generation (UX)
- WhatsApp/LINE/native share (UX)
- Copy link button (basic UX)

## Decision

**M2b Scope (Blocking):**
- ✅ SAS words (4 words from 2048-word list)
- ✅ Room lock (host toggle, persists)
- ✅ Copy link button (basic invite sharing)

**Deferred to M4:**
- ⏸️ QR code generation
- ⏸️ WhatsApp/LINE share
- ⏸️ Native share sheet API

## Rationale

### SAS Words (In M2b)
- **Security critical:** MITM detection for E2EE
- **Low complexity:** 4 words derived from secret, display on both screens
- **Blocking:** Part of E2EE verification flow

### Room Lock (In M2b)
- **Security important:** Host control over admission
- **Medium complexity:** State toggle + UI buttons
- **Blocking:** Completes admission control feature

### Copy Link (In M2b)
- **UX essential:** Without this, can't share invite URL at all
- **Trivial complexity:** `navigator.clipboard.writeText(url)`
- **Already implemented in M2** (needs testing)

### QR Code (Deferred to M4)
- **UX nice-to-have:** Mobile camera scan convenience
- **Medium complexity:** QR library + canvas rendering
- **Not blocking:** Copy link + paste works on all devices

### WhatsApp/LINE/Native Share (Deferred to M4)
- **UX nice-to-have:** One-tap sharing
- **Medium complexity:** Platform-specific APIs
- **Not blocking:** Copy link + paste into chat works

## Consequences

### M2b Deliverables
1. Client-side secret generation
2. Universal seal()/open() encryption
3. 2-peer cap + knock/admit
4. 12-hour expiry + keepalives
5. Security tests (tamper/replay/wrong-key/nonce/E2E)
6. SAS words (4-word verification)
7. Room lock (host toggle)
8. Copy link button

### M4 Additions
- QR code generation for invite URL
- WhatsApp share button (`wa.me/...`)
- LINE share button
- Native share sheet API (`navigator.share()`)

### Timeline Impact
- M2b: ~20-25 hours (no change from original estimate)
- M4: +4 hours for QR/share features

## Implementation Notes

**SAS Display:**
```tsx
{connectionState === 'ready' && (
  <div className="sas-verification">
    <h4>Security Verification</h4>
    <div className="sas-words">
      {sasWords.join(' • ')}
    </div>
    <p className="text-sm">
      Ask your partner to confirm these words match.
    </p>
  </div>
)}
```

**Room Lock Toggle (Host Only):**
```tsx
{isHost && (
  <button onClick={toggleLock}>
    {roomLocked ? '🔓 Unlock Room' : '🔒 Lock Room'}
  </button>
)}
```

**Copy Link (Already Implemented):**
```tsx
<button onClick={() => navigator.clipboard.writeText(inviteUrl)}>
  📋 Copy Invite Link
</button>
```

## References

- M2B-PLAN.md §6 (Should-have features)
- Owner instruction: "SAS + lock in M2b. QR/WhatsApp/LINE/share move to M4"
