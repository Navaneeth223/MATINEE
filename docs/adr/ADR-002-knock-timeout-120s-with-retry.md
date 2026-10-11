# ADR-002: Knock Timeout - 120 Seconds with "Knock Again" Option

**Date:** 2026-10-10  
**Status:** Accepted  
**Deciders:** Owner  
**Milestone:** M2b

## Context

When a guest knocks on a room, the host needs time to admit or deny. If the host doesn't respond, we need a timeout to prevent indefinite waiting. The timeout value affects UX:
- Too short: Host may not see notification in time
- Too long: Guest waits unnecessarily if host is AFK

## Decision

**Knock timeout: 120 seconds (2 minutes)**

After timeout:
- Auto-deny the knock
- Show guest: "Host didn't respond. [Knock Again] button"
- Guest can knock again (resets timer)

## Consequences

### Enables
- Host has reasonable time to notice knock notification
- Guest isn't stuck indefinitely
- Guest can retry if host was briefly AFK
- No permanent connection held for unresponsive hosts

### Prevents
- Instant rejection (would frustrate legitimate guests)
- Infinite waiting (wastes resources)
- Silent failure (guest knows what happened)

### Implementation
- Start 120s timer when knock sent
- If host admits/denies before timeout, cancel timer
- If timeout fires:
  - Close guest connection with reason "host_timeout"
  - Guest UI shows "Host didn't respond" + "Knock Again" button
- Knock Again creates new connection (fresh 120s timer)

## Alternatives Considered

1. **30 seconds** - Rejected: Too short, host may not see notification
2. **60 seconds** - Rejected: Still tight for hosts who step away briefly
3. **No timeout** - Rejected: Wastes Cloudflare DO duration on abandoned knocks
4. **180 seconds** - Rejected: Too long, guest frustration increases

## UX Flow

```
Guest knocks → [120s timer starts]
  ↓
Host sees notification → Admit/Deny within 120s
  ↓ (timeout)
Auto-deny + close connection
  ↓
Guest UI: "Host didn't respond. Want to try again?"
  ↓
[Knock Again] → New connection, fresh 120s timer
```

## References

- §12.2 of specification (admission control)
