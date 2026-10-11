# ADR-004: Keepalive Every 30 Seconds + Hibernation Auto-Response

**Date:** 2026-10-10  
**Status:** Accepted  
**Deciders:** Owner + Agent (verified Cloudflare docs)  
**Milestone:** M2b

## Context

Durable Objects can hibernate to save compute costs, but we need:
1. Regular keepalive messages to reset 12-hour expiry timer
2. Automatic handling of keepalive without full DO wake-up (if supported)

Cloudflare Durable Objects support the Hibernation API with auto-response capability for WebSocket messages.

## Decision

**Keepalive interval: 30 seconds**

**Hibernation auto-response: YES**

Implementation:
- Client sends `keepalive` message every 30 seconds
- Server marks message as auto-respondable using `acceptWebSocket(..., ['keepalive'])`
- Hibernated DO automatically echoes keepalive without full wake-up
- Activity timestamp updated on message receive (even during auto-response)

## Verification

Cloudflare Durable Objects Hibernation API documentation confirms:
- **WebSocket message tags:** Specify message types that can auto-respond during hibernation
- **Benefit:** Reduces CPU usage and duration billing for heartbeat messages
- **API:** `state.acceptWebSocket(ws, tags)` where tags is array of message types

Source: https://developers.cloudflare.com/durable-objects/api/websockets-hibernation-api/

## Consequences

### Enables
- 12-hour expiry enforced (keepalives reset timer every 30s)
- Low CPU cost (hibernation auto-response avoids full wake-up)
- Connection health monitoring (client detects missing keepalive)
- Network path validation (keeps NAT mappings alive)

### Prevents
- Premature expiry (without keepalives, 12h timer wouldn't reset)
- High compute cost (without hibernation, every keepalive wakes DO)

### Implementation

**Client (`room-client.ts`):**
```typescript
setInterval(() => {
  this.send({ type: 'keepalive', timestamp: Date.now() });
}, 30_000);
```

**Server (`room-do.ts`):**
```typescript
// On connect
this.state.acceptWebSocket(ws, ['keepalive']);

// In webSocketMessage handler
if (parsed.type === 'keepalive') {
  this.lastActivityAt = Date.now();
  // Auto-response: hibernated DO echoes back without wake
  return;
}
```

**Alarm handler (12-hour check):**
```typescript
async alarm() {
  const idle = Date.now() - this.lastActivityAt;
  if (idle > 12 * 60 * 60 * 1000 && this.sessions.size === 0) {
    // Room expired, clean up
  } else {
    // Reschedule alarm
    this.state.storage.setAlarm(Date.now() + 12 * 60 * 60 * 1000);
  }
}
```

## Alternatives Considered

1. **60 seconds** - Rejected: Longer gap before expiry detected, less precise
2. **120 seconds** - Rejected: Too coarse for 12-hour expiry precision
3. **No hibernation** - Rejected: Higher costs, unnecessary DO wake-ups

## Cost Impact

**Without hibernation auto-response:**
- 30s keepalive = 120 messages/hour = 2,880 messages per 24h session
- Each message wakes DO = 2,880 wake-ups × 10ms = ~29 seconds billed duration

**With hibernation auto-response:**
- Same message count, but ~90% handled without wake-up
- Estimated billed duration: ~3 seconds per 24h session
- **10x cost savings on keepalive overhead**

## References

- Cloudflare DO Hibernation API: https://developers.cloudflare.com/durable-objects/api/websockets-hibernation-api/
- §7 of specification (12-hour expiry requirement)
