# M2 Implementation Plan — Rooms + E2EE + Presence + Invite

**Milestone:** M2  
**Status:** IN PROGRESS  
**Date:** 2026-10-10

## Goal

Two users can join a named room over a deployed Cloudflare Worker, exchange an E2EE session key (ECDH P-256 → AES-GCM-256), see each other's presence, and share a room invite URL. No plaintext passes through the relay.

## Prerequisite

- Cloudflare account confirmed (no card required) — see docs/M2-CLOUDFLARE-SETUP.md
- If Cloudflare asks for a card at any point → STOP and notify owner

## Deliverables

1. Cloudflare Worker deployed (apps/edge)
2. Durable Object: RoomDO
   - WebSocket connections via Hibernation API
   - Room state: peer list, presence
3. Room creation API: `POST /api/rooms` → returns `{ roomId, inviteUrl }`
4. WebSocket endpoint: `GET /api/rooms/:roomId/ws`
5. E2EE key exchange:
   - Each peer generates ECDH P-256 key pair in browser (SubtleCrypto)
   - Public keys exchanged via Worker (relayed, not stored)
   - Derived AES-GCM-256 session key used for all subsequent messages
   - Worker never sees plaintext
6. Presence events: `peer-joined`, `peer-left`
7. Invite URL: `https://<worker>.workers.dev/room/<roomId>`
8. Basic UI: join room, show peers, copy invite link

## E2EE Protocol

```
Alice                         Worker (RoomDO)           Bob
  |------ join(pubKeyA) ------->|                         |
  |                             |------ pubKeyA --------->|
  |<----- pubKeyB --------------|<----- join(pubKeyB) ----|
  |                             |                         |
  | derive(privKeyA, pubKeyB)   |   derive(privKeyB, pubKeyA)
  |     = sharedSecret          |        = sharedSecret   |
  |     → AES-GCM-256 key       |        → AES-GCM-256 key|
  |                             |                         |
  |=== All further messages encrypted client-side ========|
```

No symmetric key ever leaves the browser. The Worker only relays ECDH public keys.

## Task List

- [ ] T1: Confirm Cloudflare account (no card)
- [ ] T2: Run `wrangler login` and `wrangler whoami`
- [ ] T3: Review existing apps/edge code (wrangler.toml, src/index.ts, RoomDO)
- [ ] T4: Implement `POST /api/rooms` endpoint in RoomDO
- [ ] T5: Implement ECDH public-key relay in RoomDO WebSocket handler
- [ ] T6: Implement client-side SubtleCrypto ECDH key exchange
- [ ] T7: Implement AES-GCM-256 encrypt/decrypt helpers
- [ ] T8: Implement presence events (join/leave broadcast)
- [ ] T9: Implement invite URL generation
- [ ] T10: Basic UI (room join form, peer list, invite link copy)
- [ ] T11: Local test: two browser tabs, same room, E2EE confirmed
- [ ] T12: Deploy to Cloudflare
- [ ] T13: Remote test: two browsers on the deployed Worker
- [ ] T14: Network inspection: confirm no plaintext through Worker

## Acceptance Criteria

- [ ] AC1: Two browsers join same room (deployed Worker)
- [ ] AC2: E2EE key exchange completes (confirmed via browser console)
- [ ] AC3: Peers see join/leave events
- [ ] AC4: Room URL is shareable and joinable
- [ ] AC5: Network inspection shows no plaintext chat/media through Worker
- [ ] AC6: Cloudflare signup required no card

## Security Notes

- ECDH public keys are relayed via Worker — this is safe (public keys are not secret)
- Session key derivation uses HKDF-SHA-256 with a room-specific salt
- Each session derives a fresh key pair; no key reuse across sessions
- Message encryption: AES-GCM-256 with random 96-bit IV per message
- Worker stores no keys and no message content

## Files to Create/Modify

- `apps/edge/src/index.ts` — Worker entry point
- `apps/edge/src/room-do.ts` — RoomDO implementation
- `apps/web/src/lib/crypto.ts` — SubtleCrypto helpers
- `apps/web/src/lib/room-client.ts` — WebSocket + E2EE client
- `apps/edge/wrangler.toml` — DO bindings

## Gate M2

M2 is complete when all acceptance criteria are met and T11–T14 pass.
