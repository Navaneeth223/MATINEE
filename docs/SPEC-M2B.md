# SPEC-M2B — exact extract of AGENT_PROMPT.md for milestone M2b
(Copied word for word from the real spec. If this extract and BRIEF.md disagree, THIS FILE wins.
Sections: §2.3 reporting, §3 Laws, §6.3 stop-the-line, §8.3 room identity, §10.4 signaling Worker,
§11 protocol + E2EE, §12.1-12.2 threat model + join control.)

Reminders added by the owner's reviewer:
- The server must NEVER see or generate roomSecret. It lives only in the URL fragment (#k=...).
- SAS words are derived from BOTH peers' session public keys + roomId (see §11.3), not from roomSecret alone.
- One seal()/open() path for every message type. No plaintext application messages.
- Room cap = 2 admitted peers. Unadmitted sockets receive nothing.
- Idle expiry 12 h; a connected socket or keepalive counts as activity.

---

### §2.3 Reporting format (use it every time you hand control back)
```
✅ Done:    <what works now, 1–3 lines, with evidence path>
⚠️ Risk:    <anything that might bite, or "none">
👉 You do:  <numbered steps, max 5, or "nothing">
❓ Decide:  <one decision with my recommended default, or "none">
```

---

## §3 — THE TWELVE LAWS (non-negotiable; breaking one is a failed task)

**Law 1 — Understand before building.** Never code from an assumption you could have verified. Verify via official docs or the live web, and record the source and date.

**Law 2 — Free means free.** Every service, library, model, and API must have a **verified free path** with limits written in `docs/FREE-TIER-LEDGER.md` (service, limit, how we stay under it, what happens at the limit, fallback). If a signup requires a payment card, tell the owner **before** proceeding and offer a card-free fallback. No surprise bills, ever. Add hard guards in code where overage is possible.

**Law 3 — Privacy by default.** No accounts. No analytics. No third-party scripts. No fonts from third-party CDNs (self-host). Camera off by default. No movie bytes ever touch our servers. The server sees only ciphertext envelopes (§12).

**Law 4 — Legitimate use only.**
- No torrent features, no scraping of streaming or piracy sites, no hosting or indexing of copyrighted media, no DRM circumvention.
- Screen-sharing of DRM-protected services may show black video; **do not try to bypass it**. Explain it kindly and steer people to Sync Together (§5.1).
- Show a one-time plain-language notice: *"Use films you own or have the right to watch. Matinee never stores or uploads your movie."*
- Subtitle sources must be used within their terms of service (§9). Unofficial scraping endpoints of translation services are **forbidden**.

**Law 5 — Mobile is not an afterthought.** Every screen, every feature, every test runs on a mid-range Android phone and an iPhone-class Safari before it is called done. Where mobile cannot do something (e.g. screen capture), the UI says so and offers the best alternative.

**Law 6 — Evidence over claims.** Never say "works" without running it. Attach evidence: command + output, test report, screenshot, or recording path. If you could not test something (no real iPhone), say exactly that and add it to the owner's real-device checklist (§17).

**Law 7 — No invented APIs.** Before using any library or browser API: check the current official docs, check it exists in the pinned version, check browser support on the target matrix (§13.1). Before `install`, run a registry lookup (`npm view <pkg> version license`). If a name looks suspicious (typosquat), stop.

**Law 8 — Secrets stay secret.** No keys in the repo, in client bundles, in logs, or in screenshots. Use Worker secrets and `.env` files that are git-ignored; add a secret scanner (gitleaks) to pre-commit and CI.

**Law 9 — Graceful degradation.** Every feature has a defined fallback and a plain-language message when unsupported. The app must never show a blank screen, a raw stack trace, or a spinner with no end.

**Law 10 — Accessible and international by construction.** WCAG 2.2 AA, keyboard control, reduced-motion support, logical CSS properties, proper Thai and Malayalam text rendering, UI strings externalised from day one.

**Law 11 — Small, reversible steps.** Short-lived branches, atomic commits, feature flags for risky work, a rollback note in every release. Never rewrite working code without a failing test or a measured reason.

**Law 12 — Be honest about limits.** Machine-generated Malayalam and Thai subtitles are imperfect. Label them. Offer an editor. Never present an AI translation as human-verified.

---

### §6.3 Stop-the-line conditions (ask the owner before continuing)
1. Any step requires a payment card or paid plan.
2. Any step would store or transmit the owner's movie file off-device.
3. A legal/ToS question appears that is not clearly resolved in the docs.
4. Two attempts at the same fix have failed (say so, then switch approach, per §2.2).
5. You are about to delete or rewrite more than ~200 lines of working code.
6. A secret or personal data could be exposed.

---

### §8.3 Room identity and roles

- `roomId`: 10 characters of Crockford Base32 (≈ 50 bits) from `crypto.getRandomValues`.
- `roomSecret`: 16 random bytes (Base64url) placed **only in the URL fragment**: `https://<host>/r/<roomId>#k=<roomSecret>`. Fragments are never sent to servers.
- `peerId`: random 8 bytes (hex) per tab session.
- **Host** = creator; holds `hostToken` (random 16 bytes) whose **hash** is registered with the room coordinator, so only the creator can *admit* the guest or *kick*. Both peers have **equal playback control**; "host" only matters for admission and for Mode B/C sources.
- Room lifetime: expires after 12 h of inactivity. No persistent room data beyond the hashed host token and settings.

---

### §10.4 The signaling Worker and `RoomDO` (hibernation-safe)

**Routes**
| Route | Purpose |
|-------|---------|
| `POST /api/rooms` | Create a room; verify Turnstile (if enabled); returns `{roomId}` (client may propose id; server confirms unused). |
| `GET /ws/:roomId` | WebSocket upgrade → `RoomDO`. Check `Origin` against allow-list. |
| `GET /api/ice` | Returns short-lived ICE servers (calls the TURN credential API using a secret). Rate-limited. |
| `GET /api/tmdb/search`, `/api/tmdb/movie/:id`, `/api/tmdb/img/*` | Cached proxy with the key hidden. Strict query validation; `Cache-Control` set. |
| `GET /api/health` | Static OK + version (no secrets). |

**`RoomDO` responsibilities and rules**
- Identify by `idFromName(roomId)`. Use `ctx.acceptWebSocket(ws, [peerId])` (**Hibernation API**), never raw `ws.accept()`.
- **Persist** minimal state in DO storage: `{hostTokenHash, createdAt, lastActiveAt, locked, maxPeers: 2, admitted: [peerId…]}`. Per-socket data (`peerId`, `admitted`, token-bucket counters) in `ws.serializeAttachment()` (small, ≤ 2 KiB). **Assume all in-memory state vanishes on hibernation.**
- **Admission:** first socket presenting a valid `createProof` becomes host (store `sha256(hostToken)`). Others send `knock`; the DO forwards it to the host socket; only `admit{peerId}` **from the host socket** (authenticated by `hostToken`) marks a peer admitted. Unadmitted sockets **receive nothing** except `deny`/`wait`/`full`.
- **Capacity:** at most `maxPeers` admitted; extra knocks → `full`.
- **Relay:** validate envelope shape and size (≤ 64 KiB), enforce per-socket rate limits (e.g. burst 40 msgs, 20 msgs/s sustained, tighter for `knock`), forward to `to` or broadcast to the other admitted peers. **Never parse or log `ct`.**
- **Expiry:** `setAlarm()` for idle expiry (12 h) → close sockets, delete storage.
- **Quota guard:** count messages per day in a small global counter; when near a limit (RQ-01), refuse *new* room creations first, keep existing rooms alive, and return the "tonight's capacity" message.
- **Cost hygiene:** clock pings and beacons use the WebRTC data channel when it's open; the relay carries them only as a fallback and at reduced frequency (ping every 30 s; beacons only on state changes) to conserve free quota. (WebSocket message billing ratio — verify in RQ-01.)
- **Observability without spying:** log only counters (rooms created, knocks, rejects, errors) — no IPs, no payloads, no room ids in logs.

**Skeleton (illustrative; verify API names against current Workers docs before using):**
```ts
export class RoomDO {
  constructor(private ctx: DurableObjectState, private env: Env) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 400 });
    const [client, server] = Object.values(new WebSocketPair());
    const peerId = new URL(req.url).searchParams.get('p') ?? crypto.randomUUID();
    this.ctx.acceptWebSocket(server, [peerId]);                // hibernation-safe
    server.serializeAttachment({ peerId, admitted: false, bucket: { t: Date.now(), n: 40 } });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    // 1) size + rate checks 2) parse envelope with zod 3) route by env.t 4) never touch env.ct
  }
  async webSocketClose(ws: WebSocket) { /* mark presence=left, notify peers */ }
  async alarm() { /* idle expiry */ }
}
```

**Fallback transport:** implement `SignalingTransport` (`connect`, `send`, `onMessage`, `onClose`) with two adapters: `CloudflareDoTransport` (default) and `NodeWsTransport` (small `ws` server for Render/Koyeb-class free hosts; keep it ≤ 200 lines; documents cold-start behaviour). Switch via `VITE_SIGNALING_URL`/runtime config; test both in CI against the same protocol test-suite.

---

## §11 — PROTOCOL SPECIFICATION (`packages/protocol`, documented in `docs/PROTOCOL.md`)

### §11.1 Outer envelope (server-visible)
```ts
export const Envelope = z.object({
  v: z.literal(1),
  t: z.enum(['create','knock','admit','deny','wait','full','sig','msg','presence','bye','ping','pong']),
  from: z.string().length(16),            // peerId hex
  to: z.string().length(16).optional(),   // omitted = other admitted peer(s)
  seq: z.number().int().nonnegative(),    // per-sender, strictly increasing within a session
  sid: z.string().length(8),              // session id (random prefix for nonce uniqueness)
  iv: z.string().optional(),              // base64url, 12 bytes
  ct: z.string().optional(),              // base64url AES-GCM ciphertext of inner JSON
  proof: z.string().optional(),           // HMAC(kAuth, nonce) — for knock/create only
}).strict();
```
The server may read `t/from/to/seq/size` and nothing else.

### §11.2 Inner messages (encrypted; schema-validated on receipt)

| Type | Fields | Channel | Notes |
|------|--------|---------|-------|
| `hello` | `name`, `avatar`, `lang`, `caps`, `rev`, `playback?`, `fp?`, `buffering`, `epk` (ephemeral pubkey) | ctl | On every (re)connect. |
| `cmd` | `cmd: 'play'|'pause'|'seek'|'rate'`, `mediaMs?`, `rate?`, `baseRev`, `nonce` | ctl | §8.5.2 |
| `state` | full `Playback` | ctl | Authoritative after resolve. |
| `clk.ping` / `clk.pong` | `id`, `t0`, `t1?`, `t2?` | clk | §8.5.1 |
| `buf` | `on: boolean`, `readyAheadMs?` | ctl | Buffering notice. |
| `ready` | `ready: boolean` | ctl | Foyer ready-up. |
| `reel` | `fp`, `sizeBytes`, `durationMs`, `w`, `h`, `container` | ctl | Fingerprint exchange. |
| `offset` | `mediaOffsetMs`, `by` | ctl | Calibrator result. |
| `chat` | `id`, `text` (≤ 500 chars) | ctl | Plain text only. |
| `react` | `emoji` (allow-list), `x`, `y` | ctl | Floating reactions. |
| `heart` | `intensity: 1..3` | ctl | Heartbeat nudge. |
| `moment` | `id`, `mediaMs`, `note` | ctl | Saved moment. |
| `trk.manifest` | `trackId`, `lang`, `kind`, `label`, `cueCount`, `sha256`, `bytes` | ctl | §9.11 |
| `trk.req` / `trk.chunk` / `trk.done` | `trackId`, `i`, `n`, `data` (b64url, ≤ 16 KiB) | ctl | Chunked, back-pressured. |
| `sdp` / `ice` | `description` / `candidate` | sig (relay) | Perfect negotiation. |
| `mode` | `mode: 'together'|'fromme'|'screen'`, `source: peerId?`, `preset?` | ctl | Mode changes. |
| `pos` | `mediaMs`, `roomMs` | clk | Mode B/C beacons. |
| `intermission` | `untilRoomMs?`, `cancel?` | ctl | Shared timer. |
| `settings` | `onDrop: 'pause'|'continue'`, `lock: boolean` | ctl | Room-level toggles. |
| `bye` | `reason` | ctl | Leaving cleanly. |

Rules: **unknown fields rejected**, size limits per type, rate limits per type (e.g. `chat` ≤ 5/s, `react` ≤ 10/s), emoji allow-list, all numeric fields clamped.

### §11.3 End-to-end encryption (WebCrypto only)

**Keys**
```
roomSecret   (16 random bytes, in URL #fragment only)
K_enc  = HKDF-SHA256(ikm = roomSecret, salt = roomId, info = "matinee/v1/enc",  L = 32 bytes)  → AES-GCM key
K_auth = HKDF-SHA256(ikm = roomSecret, salt = roomId, info = "matinee/v1/auth", L = 32 bytes)  → HMAC key
```
**Session key (forward secrecy — Should):** each peer generates an ephemeral ECDH key pair (P-256 or X25519 if available) per session, sends the public key in `hello` (sealed under `K_enc`), and both derive
`K_sess = HKDF(ikm = ECDH_shared ‖ K_enc_raw, salt = sidA ‖ sidB, info = "matinee/v1/sess")`. Subsequent messages use `K_sess`. A later leak of the link then cannot decrypt recorded traffic.

**Nonces and AAD**
- 96-bit nonce = `sid` (32-bit random per session) ‖ `counter` (64-bit, per sender, incremented per message). **Never reuse.** Persist nothing; a reconnect creates a new `sid`.
- AAD = `"v1|" + t + "|" + from + "|" + (to ?? "*") + "|" + seq`.
- Receiver **rejects** `seq ≤ lastSeq[from][sid]` (replay) and any decryption failure (log a counter only).

**Join proof:** `knock.proof = HMAC(K_auth, "knock|" + peerId + "|" + serverNonce)`; the host verifies before showing "Someone is at the door."

**Short authentication string (SAS) — defence in depth:** after `hello` exchange, compute `SHA-256(sort(epkA, epkB) ‖ roomId)` and map **4 words** from a curated 2,048-word list (≈ 44 bits) to display *"Say these four words to each other: ember · velvet · harbor · lantern."* Mismatch → a clear warning and an option to close the room. (The room secret already authenticates; SAS defends against a compromised link or server.)

**Honest limits (write them into `docs/SECURITY.md` and the Privacy page):** E2EE protects against the server and network observers. It does **not** protect against someone who has the link **and** is admitted by the host; against a compromised device; or against screenshots/recording on the partner's side.

### §11.4 Versioning and compatibility
- `v` in the envelope; reject unknown major versions with a friendly "Please refresh to update."
- Maintain `docs/PROTOCOL.md` as the source of truth, with example JSON for every message and a **conformance test-suite** reused by both signaling transports and the sim.

---

### §12.1 Threat model (`docs/SECURITY.md` starts here)

| Asset | Threat / adversary | Mitigation |
|-------|--------------------|------------|
| Conversations, subtitles, signaling | Server operator, network observer | E2EE (§11.3); TLS; DTLS-SRTP for media. |
| Room access | Link leaked/guessed; ex-partner with an old link | 50-bit id + secret + **host approval** + **Lock room** + **Regenerate link** + auto-expiry. |
| Third person joining | Link forwarded | Max 2 peers; knock/approve; "seat taken" for others. |
| Movie file | Exfiltration | Never uploaded; no file APIs beyond local `File`; CSP blocks unknown hosts. |
| Client XSS | Malicious chat/subtitle/filename | No HTML injection; `textContent`; strict CSP; Trusted Types where feasible. |
| Malicious subtitle/media files | Parser bugs, huge inputs | Workers; size caps; zod; time-outs; never `eval`; sanitised output. |
| Prompt injection via subtitles | Dialogue that instructs the LLM | Delimited data, rule 7 in §9.7.3, strict JSON output + validation. |
| Abuse/bots | Room-creation spam, DoS | Turnstile (optional), rate limits, DO caps, kill-switches. |
| Quota exhaustion = cost/denial | Accidental or hostile overuse | Free-tier guards (§17.4), graceful degradation messages. |
| IP exposure to peer | WebRTC reveals IP | *Hide my IP* (relay-only), explained clearly. |
| Secrets | Leaks in repo/bundle | Worker secrets, scanner, bundle check. |
| Shoulder-surfing / screen recording | Partner or bystanders | Out of scope; mention in docs. |

### §12.2 Join control and room hygiene
- Flow: **link → knock → host sees "Someone is at the door" (with their chosen name) → Admit/Deny.** The proof in `knock` auto-denies wrong-secret attempts.
- Controls (host): **Lock room**, **Remove guest**, **Regenerate link** (new `roomId` + `roomSecret`, existing session continues re-keyed), **End room** (DO storage wiped).
- Rooms **auto-expire**; show "Room closes in 11 h 40 m of idle time" in settings.
- Never show the room code in the page title/history in a way that leaks via screenshots in notifications; show it on demand.
