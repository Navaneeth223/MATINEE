# ADR-003: Room Lock - Host Toggle, Persists Until Unlocked

**Date:** 2026-10-10  
**Status:** Accepted  
**Deciders:** Owner  
**Milestone:** M2b

## Context

Host needs ability to lock room to prevent new guests from joining. Two behaviors were considered:
- **Permanent:** Lock persists until host explicitly unlocks
- **Temporary:** Lock auto-unlocks when current guest disconnects

The choice affects security model and UX for reconnection scenarios.

## Decision

**Room lock is a host toggle that persists until explicitly unlocked.**

- Host can lock at any time (even when 2 peers connected)
- Lock survives guest disconnections
- New connection attempts see "Room locked" error
- Host must explicitly unlock to allow new guests

## Consequences

### Enables
- Host controls session security (prevent uninvited guests)
- Protection during temporary disconnects (guest reconnects without re-admission)
- Clear security model (locked = no new admissions until host says so)

### Prevents
- Automatic unlocking (intentional - host must explicitly allow access)
- Guest rejoining on different device without knock (security feature)

### Implementation
- Room state enum: `WAITING | FULL | LOCKED`
- Lock/Unlock buttons visible to host when room not empty
- Locked rooms reject all new connections immediately
- Guest sees: "This room is locked. Ask the host to unlock it."

### Reconnection Behavior

**Same socket reconnects (WebSocket reconnection):**
- Allowed (same peerId, preserves session)

**New device/browser (different socket, same person):**
- Must knock again (treated as new connection)
- Host can verify identity before admitting

## Alternatives Considered

1. **Temporary lock (unlocks on disconnect)** - Rejected: Less secure, confusing UX
2. **Auto-lock when full** - Rejected: Too restrictive, prevents legitimate reconnects
3. **No lock feature** - Rejected: Host has no control over who joins

## UI

Host controls:
```
[Lock Room] button → sets state to LOCKED
[Unlock Room] button → sets state back to FULL or WAITING
```

Guest sees when locked:
```
⚠️ This room is locked
The host has restricted access to this session.
```

## References

- §12.2 of specification (admission control)
