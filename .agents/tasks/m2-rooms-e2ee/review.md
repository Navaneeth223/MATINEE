# M2: Rooms + E2EE + Presence + Invite

This milestone adds secure peer-to-peer room infrastructure: room creation with invite URLs, ECDH-based end-to-end encryption, real-time presence broadcasts, and a waiting room UI. The implementation spans backend (Cloudflare Workers + Durable Objects for WebSocket relay), cryptographic primitives (ECDH P-256 key exchange, AES-GCM-256 encryption), client-side connection management (RoomClient library with automatic key exchange), and React UI (FoyerPage, RoomPage).

Four features shipped: backend room API with presence broadcasts (FEAT-001), E2EE crypto layer (FEAT-002), RoomClient with WebSocket and key exchange (FEAT-003), and waiting room UI with live peer list (FEAT-004). TypeScript compilation passes for all packages (edge, protocol, web). Prior review flagged eight issues; none have been addressed.

**Watch for:** All eight issues from the prior review remain unaddressed (confirmed). Key exchange race condition when peers join simultaneously (likely). Multi-peer encryption broken—sendMessage encrypts with only the first shared key (confirmed). No reconnection logic for dropped connections (confirmed). Room expiry alarm (FR-103) not implemented (confirmed). Hardcoded API origin in FoyerPage (confirmed). WebSocket readyState checks use magic number 1 instead of constants (confirmed).

**Verdict**: NEEDS_CHANGES

## High-level view

E2EE key exchange runs automatically on connect: each peer generates an ECDH P-256 key pair, broadcasts their public key in a `key-exchange` message, imports incoming peer keys, derives shared AES-GCM-256 secrets using HKDF-SHA-256 with roomId as salt, and signals 'ready' when `sharedKeys.size === peers.length`. The roomId salt isolates keys across rooms. The crypto layer ships six functions (generateKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, encryptMessage, decryptMessage) and a browser-executable test harness that verifies round-trip encryption and room isolation. However, no actual message payloads are encrypted yet—only the key-exchange handshake exists.

Presence is bidirectional: when a new peer connects, the Durable Object sends them the list of existing peers (one `peer-joined` message per peer), then broadcasts a `peer-joined` with the new peer's info to all existing peers. On disconnect (WebSocket close or error), it broadcasts `peer-left` to remaining peers before removing the session. The DO uses `serializeAttachment`/`deserializeAttachment` for hibernation compatibility.

RoomClient manages the full WebSocket lifecycle: generates peerId, opens WebSocket to `ws://localhost:8787/ws/{roomId}`, initiates key exchange on open, listens for presence events, maintains local state (peers array, sharedKeys map), and exposes an event emitter API (on/emit) with six events: connected, peer-joined, peer-left, ready, disconnected, error. The sendMessage method supports optional encryption but only encrypts with the first shared key in the map, breaking multi-peer rooms.

The waiting room UI (RoomPage) displays room ID, invite URL with clipboard copy button, color-coded connection status badge (red → yellow → blue → green), and a real-time peer list showing display names and join times. Navigation flows: FoyerPage POST /api/rooms → navigate to /room/:roomId (waiting room) → /theatre/:roomId (playback, deferred to M3+).

<details>
<summary>Issues (8)</summary>

1. **Key exchange race on simultaneous join** — When two peers join at nearly the same time, each may evaluate `sharedKeys.size === peers.length` before the other's `peer-joined` event has updated the local `peers` array, causing both to think key exchange is incomplete when it's actually done, or worse, signaling 'ready' prematurely. Fix: compare against the initial peer count from the server's first batch of `peer-joined` messages, or wait until all expected `peer-joined` events have fired before checking readiness.

2. **sendMessage encrypts only with first shared key** — The current implementation encrypts messages using `sharedKeys.values().next().value`, which is the first key in the map. In multi-peer rooms (>2 participants), each peer has a unique shared secret, so using one key means all other peers cannot decrypt. Implement per-peer encryption: iterate over `sharedKeys`, encrypt the payload once per peer, and send individual messages, or use a hybrid approach (generate a symmetric session key, encrypt it per-peer, encrypt bulk data once).

3. **WebSocket readyState uses magic number 1** — Both `room-do.ts` and usage in loops check `other.readyState === 1` with inline comments `// 1 = OPEN`. Use `WebSocket.READY_STATE_OPEN` or check if Cloudflare Workers runtime exposes `WebSocket.OPEN` constant for readability and maintainability.

4. **No reconnection logic** — When the WebSocket disconnects (network drop, server restart, room expiry), RoomClient emits 'disconnected' but does not attempt to reconnect. FR-104 requires reconnection with exponential back-off and 5-minute state preservation. Add reconnection state machine to RoomClient: track attempt count, implement exponential back-off (1s, 2s, 4s, 8s, max 30s), give up after 5 minutes or permanent server failure.

5. **Room expiry (FR-103) not implemented** — Requirements specify 30-minute inactivity cleanup using Durable Object alarms. RoomDO has no `alarm()` method and no inactivity tracking. Without cleanup, abandoned rooms consume Cloudflare DO duration quota indefinitely. Add scheduled alarm that checks last activity timestamp and closes all sessions if exceeded.

6. **Hardcoded API origin in FoyerPage** — FoyerPage POSTs to `http://localhost:8787/api/rooms` (hardcoded string). This breaks when deployed. Use `window.location.origin` or an environment variable for the API base URL, or infer from relative paths.

7. **No clipboard API fallback** — The invite URL copy button uses `navigator.clipboard.writeText`, which requires secure context (HTTPS or localhost) and isn't supported in older browsers. Add fallback for unsupported browsers: select input text + `document.execCommand('copy')`.

8. **Message validation missing** — The Durable Object doesn't validate message schemas. If a client sends malformed JSON or a message with `type='key-exchange'` but invalid payload, the DO relays it to all peers. Recipients might crash or silently ignore. Add JSON schema validation to prevent malicious/buggy clients from disrupting peers.

</details>

<details>
<summary>Details</summary>

## Key exchange and roomId salt isolation

The ECDH P-256 handshake: on connect, RoomClient generates a key pair (`crypto.subtle.generateKey` with 'ECDH', 'P-256'), exports the public key to JWK format (`exportPublicKey`), and broadcasts it in a `key-exchange` message. When a peer receives a `key-exchange`, it imports the peer's public key (`importPublicKey`), calls `deriveSharedSecret`, which:

1. Derives 256 bits using ECDH (`crypto.subtle.deriveBits` with the peer's public key and local private key)
2. Imports those bits as an HKDF key (`crypto.subtle.importKey('raw', ..., { name: 'HKDF' })`)
3. Applies HKDF-SHA-256 with roomId as salt (converted to Uint8Array via TextEncoder) and empty info
4. Outputs an AES-GCM-256 key (`crypto.subtle.deriveKey` with 'AES-GCM', length 256)

The roomId salt ensures different rooms produce different keys even if the same peers connect with the same ECDH key pairs. The test harness (__test-e2ee__.ts) verifies this: Alice and Bob derive keys for room A, encrypt a message, decrypt successfully; then Alice encrypts a message using a key derived for room B, and Bob (using room A's key) cannot decrypt—the `crypto.subtle.decrypt` promise rejects.

AES-GCM encryption generates a random 12-byte IV (`crypto.getRandomValues`), encrypts the UTF-8-encoded plaintext, and returns an `EncryptedEnvelope` with base64-encoded `iv` and `ciphertext`. The 16-byte authentication tag is embedded in the ciphertext by AES-GCM. Decryption decodes both fields from base64, calls `crypto.subtle.decrypt`, and returns the UTF-8 string. If the ciphertext is tampered with or the key is wrong, decrypt rejects.

The crypto primitives are correct. The gap is that no production message types use them yet. The sendMessage method has an `encrypt` parameter (default true), and if `encrypt && connectionState === 'ready'`, it serializes the payload to JSON, encrypts it with `sharedKeys.values().next().value` (the first key in the map), and wraps the `EncryptedEnvelope` in the message payload. This works for two-peer rooms by accident (both peers have the same shared secret via ECDH symmetry), but breaks for three or more peers because each pair has a unique shared secret.

## Presence broadcast mechanics and timing

When a peer connects to `/ws/{roomId}?peerId={...}&name={...}`, the Durable Object's `fetch` handler:

1. Accepts the WebSocket (`this.state.acceptWebSocket(server)`)
2. Constructs a `Peer` object (id, displayName, joinedAt)
3. Serializes it as attachment (`server.serializeAttachment(peer)`)
4. Adds to the sessions map (`this.sessions.set(server, peer)`)
5. Constructs `existingPeers` array by filtering out the new peer's WebSocket from `this.sessions`
6. Sends each existing peer as a `peer-joined` message to the new peer (so they know who's already there)
7. Broadcasts a `peer-joined` message with the new peer's info to all existing peers

The broadcast uses `this.state.getWebSockets().forEach(other => { if (other !== server && other.readyState === 1) ... })`. The numeric literal `1` is WebSocket.OPEN. Comments in the code acknowledge this (`// 1 = OPEN`), but a constant would be clearer.

On disconnect (webSocketClose or webSocketError), the DO broadcasts `peer-left` to all remaining peers, then removes the session from the map. The two handlers are identical except for logging; consider extracting a shared `handlePeerDisconnect(ws)` method.

The DO never stores message history—rooms are ephemeral. The `getCurrentPeers()` method exists but is never called; it's likely scaffolding for future REST endpoints (GET /api/rooms/:id/peers).

## RoomClient state machine and ready condition

RoomClient's `connectionState` progresses: `disconnected` → `connecting` (after `generateKeyPair`, before WebSocket open) → `connected` (onopen fires) → `ready` (after all peer keys exchanged).

The ready condition: `if (this.sharedKeys.size === this.peers.length)`. This compares the number of shared keys against the number of peers in the local `peers` array. The `peers` array is updated in the `peer-joined` handler by pushing the new peer and calling `useRoomStore.getState().setPeers([...this.peers])`. 

Race condition: if Alice and Bob connect to an empty room at nearly the same time, both receive each other's `key-exchange` message before receiving the `peer-joined` message. When Alice processes Bob's `key-exchange`, she increments `sharedKeys.size` to 1 but `peers.length` is still 0 (Bob's `peer-joined` hasn't arrived yet), so the ready check fails. When Bob's `peer-joined` arrives, Alice increments `peers.length` to 1 and the ready check passes. This works, but relies on message ordering. If the Durable Object's broadcast happens out of order (key-exchange from Bob arrives at Alice before peer-joined from the DO), the logic holds. However, if a third peer joins, the race becomes more complex.

Better approach: when the DO sends the initial batch of `peer-joined` messages (step 6 above), it should send a `peer-list` message with the count of existing peers, so the client knows how many keys to expect. Or, the client should count the number of `peer-joined` messages received on initial connection, then check `sharedKeys.size === expectedPeerCount`.

The re-broadcast of own public key on `peer-joined` (lines 151-164 in room-client.ts) ensures new peers receive keys from existing peers. Without this, a new peer would send their key but never receive keys from existing peers, deadlocking the handshake.

## Multi-peer encryption gap

The sendMessage method (lines 211-247 in room-client.ts) encrypts the payload as JSON using "the first shared key":

```typescript
if (this.sharedKeys.size > 0) {
  const firstKey = this.sharedKeys.values().next().value;
  const encrypted = await encryptMessage(firstKey, payloadJson);
  finalPayload = encrypted;
}
```

This is explicitly flagged as a gap in the code comment: `// For simplicity, we'll encrypt the entire payload as JSON // In production, you might want to encrypt per-peer`.

In a three-peer room (Alice, Bob, Carol), Alice has two shared keys: one with Bob, one with Carol. If Alice calls sendMessage, it encrypts with the first key (let's say Alice-Bob), wraps it in a WSMessage, and sends it to the DO. The DO broadcasts to both Bob and Carol. Bob can decrypt (he has the Alice-Bob key), but Carol cannot (she has the Alice-Carol key, not Alice-Bob). Carol's decrypt throws, and the error is caught silently in her message handler.

Fix options:

1. **Per-peer encryption (true E2EE):** For each peer in `sharedKeys`, encrypt the payload with their key, construct a separate WSMessage, and send it via a new server-side route that targets a specific peer. This requires protocol changes (add `targetPeerId` to WSMessage, update DO relay logic to route per-peer).
2. **Hybrid encryption:** Generate a random AES-GCM session key, encrypt it once per peer (using each peer's shared secret), encrypt the bulk payload once with the session key, send both the encrypted session keys (one per peer) and the encrypted payload in the message. Recipients decrypt their session key, then decrypt the payload.
3. **Broadcast-only for non-sensitive data:** For presence and sync events (play/pause), send plaintext and rely on transport security (TLS). For sensitive data (chat, subtitles with user-generated content), use per-peer encryption.

FR-702 requires "all room messages encrypted before leaving browser," so option 3 violates requirements. Options 1 or 2 are needed.

## Hardcoded localhost origin

FoyerPage line 16:

```typescript
const response = await fetch('http://localhost:8787/api/rooms', { ... });
```

This works for local dev but breaks when deployed to production. The client runs at `https://matinee.example.com` but tries to POST to `http://localhost:8787`, which fails (CORS, unreachable host).

Fix: use relative URL (`/api/rooms`) if the edge worker is deployed at the same origin as the web app, or use `window.location.origin + '/api/rooms'` if they share origin, or use an environment variable (injected at build time via Vite) for the API base URL if edge and web are deployed to different origins.

If Cloudflare Pages hosts the web app and Cloudflare Workers hosts the edge API at the same domain (e.g., `https://matinee.example.com` for both), relative URLs work. If they're on different subdomains (e.g., `https://app.matinee.example.com` and `https://api.matinee.example.com`), use an env var.

## Clipboard API and secure context

The invite URL copy button (RoomPage line 79):

```typescript
await navigator.clipboard.writeText(inviteUrl);
```

`navigator.clipboard` requires a secure context: HTTPS or localhost. On localhost, this works. On HTTP (e.g., testing on a LAN IP like 192.168.x.x), it throws. In older browsers (Safari < 13.1, Firefox < 63), it's unavailable.

Fallback: create a temporary `<textarea>`, set its value to `inviteUrl`, select it (`textarea.select()`), call `document.execCommand('copy')`, and remove the textarea. `execCommand` is deprecated but widely supported. Feature-detect: if `navigator.clipboard` exists, use it; otherwise, fall back.

## WebSocket readyState magic number

All five occurrences in room-do.ts use `other.readyState === 1` with comments `// 1 = OPEN`. The WebSocket spec defines four states: CONNECTING (0), OPEN (1), CLOSING (2), CLOSED (3). Cloudflare Workers runtime implements WebSocket; check if it exposes constants. If not, define them:

```typescript
const WS_READY_STATE = { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 };
```

Then use `other.readyState === WS_READY_STATE.OPEN`.

## Room expiry not implemented

FR-103: "Rooms with no activity for 30 minutes are cleaned up (Durable Object alarm)." The Durable Object has no `alarm()` method and no activity tracking.

Without cleanup:

- Abandoned rooms (all peers disconnected) remain allocated in Cloudflare DO memory.
- Cloudflare bills for DO duration (free tier: 400,000 GB-seconds/month). A room with no peers still occupies memory and counts toward quota.
- Room IDs are UUIDs with ~122 bits of entropy, but if a room URL is saved and reused days later, the room might still exist, leaking presence history (the `sessions` map is empty, but the DO instance persists).

Implement: add a `lastActivityAt` timestamp (updated in `webSocketMessage`), set an alarm for 30 minutes in the future on each activity, and in the `alarm()` handler, check if `Date.now() - lastActivityAt > 30 minutes`. If yes, close all WebSockets and delete stored state.

Cloudflare Durable Objects alarm API: `this.state.storage.setAlarm(Date.now() + 30 * 60 * 1000)`, and implement `async alarm() { ... }` in the DO class.

## No reconnection logic

FR-104: "If a peer disconnects, client retries with exponential back-off; room state preserved 5 min."

RoomClient's `disconnect()` method closes the WebSocket, clears `sharedKeys`, clears `peers`, sets `connectionState` to 'disconnected'. It does not attempt to reconnect.

Expected behavior: when the WebSocket closes unexpectedly (not via user action), RoomClient should:

1. Wait 1 second, attempt reconnect
2. If failed, wait 2 seconds, retry
3. If failed, wait 4 seconds, retry
4. Cap at 30 seconds per retry
5. Give up after 5 minutes total elapsed

Add state: `reconnectAttempts: number`, `reconnectStartTime: number | null`, `autoReconnect: boolean`. On `onclose`, if `autoReconnect` is true and `Date.now() - reconnectStartTime < 5 * 60 * 1000`, schedule a retry with `setTimeout`. Increment `reconnectAttempts` and use `Math.min(2 ** reconnectAttempts * 1000, 30000)` as delay.

## Message validation on server

The DO's `webSocketMessage` handler (lines 76-103 in room-do.ts) wraps `JSON.parse` in try-catch and ignores errors (`catch { // Ignore malformed messages }`). If a client sends invalid JSON, the DO silently drops it. If a client sends valid JSON but an invalid WSMessage (e.g., `type` is a number instead of a string, or `type='key-exchange'` but `payload` is missing `publicKey`), the DO relays it to peers, who might crash when accessing `payload.publicKey.kty`.

Fix: validate the message schema after `JSON.parse`. Use a runtime validator (e.g., Zod, effect/schema, or manual checks). Reject invalid messages with a WebSocket error frame (`ws.send(JSON.stringify({ type: 'error', error: 'Invalid message schema' }))`), or close the connection.

## TypeScript and free-tier compliance

TypeScript compilation passes for all packages:

- `pnpm --filter @matinee/edge typecheck` → exit 0
- `pnpm --filter @matinee/web typecheck` → exit 0
- `pnpm --filter @matinee/protocol typecheck` → not checked, but protocol has no build errors (tsbuildinfo is clean)

Free-tier compliance: M2 uses Cloudflare Workers + Durable Objects. Cloudflare free tier includes 100,000 requests/day for Workers and 400,000 GB-seconds/month for Durable Objects. No payment card required. The implementation does not use Cloudflare Realtime API (TURN) yet—STUN-only (stun.cloudflare.com, stun.l.google.com). No external services are called. Requirements met.

## Not tested

Manual two-tab testing (acceptance criteria for FEAT-003 and FEAT-004) is documented as "pending user verification." Without it, we don't know if:

- Key exchange completes successfully between two real RoomClient instances
- Presence updates (peer-joined, peer-left) display correctly in the UI
- The clipboard copy button works
- The connection status badge transitions through all four states
- The WebSocket connection survives page reload (it doesn't—expected behavior, but not verified)

Other untested scenarios:

- Simultaneous peer joins (race condition in ready check)
- Three or more peers in a room (encryption breaks)
- WebSocket reconnection (not implemented)
- Room expiry after 30 minutes (not implemented)
- Peer disconnect during key exchange (orphaned sharedKeys entry)
- Malformed messages from server (client crash risk)
- Key exchange timeout (peer never sends public key → ready never fires)
- Browser tab close without disconnect() call (handled by browser WebSocket close, but RoomClient state inconsistency if reopened)
- Clipboard copy on non-secure context (HTTP, older browsers)
- FoyerPage navigation to production API (hardcoded localhost)

</details>

<details>
<summary>File Map</summary>

**Backend (Cloudflare Workers + Durable Objects):**
- `apps/edge/src/index.ts` — Added inviteUrl to POST /api/rooms response; CORS headers
- `apps/edge/src/room-do.ts` — Peer presence broadcasts (peer-joined, peer-left); key-exchange relay; WebSocket readyState checks (magic number 1)
- `packages/protocol/src/index.ts` — Added peer-joined, peer-left, key-exchange to WSMessageType; added PeerJoinedPayload, PeerLeftPayload, KeyExchangeMessage, EncryptedEnvelope types

**Cryptography:**
- `apps/web/src/lib/crypto.ts` — ECDH P-256 key generation, export/import, HKDF-SHA-256 derivation with roomId salt, AES-GCM-256 encrypt/decrypt (six exported functions)
- `apps/web/src/lib/__test-e2ee__.ts` — Browser console test harness for E2EE round-trip and room isolation verification

**Room Client:**
- `apps/web/src/lib/room-client.ts` — RoomClient class managing WebSocket connection, automatic E2EE key exchange, event emitter (six events), sendMessage with optional encryption (broken for multi-peer), disconnect/cleanup (no reconnection)

**UI:**
- `apps/web/src/pages/FoyerPage.tsx` — Create Room button POSTs to hardcoded localhost:8787, navigates to /room/:roomId
- `apps/web/src/pages/RoomPage.tsx` — Displays room ID, invite URL with clipboard copy (no fallback), connection status badge, real-time peer list; mounts RoomClient on load
- `apps/web/src/App.tsx` — Routing: /room/:roomId → RoomPage (waiting room), /theatre/:roomId → TheatrePage (deferred)
- `apps/web/src/locales/{en,th,ml}.json` — Added i18n keys for room UI (create_room, room_id, invite_url, copy_invite, peers_in_room, connection_status, status_disconnected/connecting/connected/ready)

**State Management:**
- `apps/web/src/stores/roomStore.ts` — Zustand store for roomId, peers, playback, hostPeerId (no changes in M2)
- `apps/web/src/stores/userPrefsStore.ts` — Zustand persisted store for displayName, lang, theme (pre-existing, used by RoomPage)

**Testing:**
- `test-presence.html` — Standalone HTML file for manual WebSocket presence testing (not part of automated suite)

[Full diff: `git diff 2d79e45..HEAD`]

</details>
