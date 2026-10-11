# ASSUMPTIONS

> Recorded: 2026-10-08. Defaults applied where the owner left fields blank.
> Any assumption can be overturned at any Gate — just say so.

| ID | Assumption | Reason chosen | How to detect if wrong | Cost if wrong |
|----|-----------|--------------|------------------------|---------------|
| A01 | Owner device: Windows laptop + PC (Chrome/Edge); plays films in VLC | CR-001 2026-10-10 | Owner reports a bug specific to another browser | Low — we test Chrome/Edge P0 anyway |
| A02 | Partner device: MacBook (Safari or Chrome); probably does NOT have the film file | CR-001 2026-10-10 | Partner reports she has file locally | Low — Mode B (From Me) is our main mode now |
| A03 | Partner country: unknown; assume <= 300 ms RTT; owner's upload speed unknown (to be measured) | CR-001 2026-10-10 | Sync quality poor; doctor reports high RTT | Medium — sync engine handles up to 400 ms RTT gracefully |
| A04 | Mode B (From Me) is the MUST-have primary mode; Together mode after M5 | CR-001 2026-10-10: partner likely doesn't have file | Owner confirms partner has file locally | High — Mode B moves to M3; core feature |
| A05 | Owner will create free Cloudflare + TMDB accounts and a free Gemini API key | Owner confirmed ("yes, guide me") | Owner declines a step | Low — we provide step-by-step guide and card-free fallbacks |
| A06 | App name: "Matinee"; tone: warm, quiet, cinematic | Prompt default | Owner requests a rename | Zero — rename is a 5-minute config change |
| A07 | "Fingerprint" = file hash (section 8.4). STT runs only when section 9.4 routing finds no good existing subtitles. | Owner correction 2026-10-08 | n/a — correction is definitive | n/a |
| A08 | The Cloudflare edge server routes sealed E2EE envelopes only; it never stores or decrypts movie content or chat | Owner correction 2026-10-08 | n/a — correction is definitive | n/a |
| A09 | UI language at launch: English (default), Malayalam, Thai | Spec section 15.1 | Owner requests additional language | Medium — i18n scaffold is extensible |
| A10 | Reference date for research: 2026-10-08 (today) | Prompt section 7.0 rule 4 | Any source older than 12 months for free tiers is re-verified | Low — we re-verify before relying on any fact |

---

## A12 — Mode B Transport (REVISED 2026-10-10)

**Assumption:** Mode B (From Me) uses WebRTC peer-to-peer for video/audio media. WebSocket handles signaling only (SDP offer/answer, ICE candidate exchange). No TURN relay for M1-M2.

**Previous text STRUCK:** "WebSocket-only M1-M4" — removed per owner direction.

**Relay plan:** Two-network WebRTC test runs at the start of M3. TURN relay decision made then.

**Safari constraint:** Safari cannot send (HTMLMediaElement.captureStream() unavailable). Safari users can receive only. UI shows "Use Chrome or Firefox to send."

## A13 — Voice/Video Relay Deferred to M5

Voice and video calling are out of scope for M1–M4. The relay provider decision (Cloudflare Realtime vs Metered vs other) is deferred to M5. At M5 the team must verify: (a) Metered's current free-tier limits and whether signup requires a payment card, (b) who operates the relay, and (c) whether card-free signup is possible. Until that verification is complete, no TURN configuration is committed.

## A14 — MacBook Partner Web-Only (CR-001)

Partner uses MacBook with Safari or Chrome via web browser only. PWA "Add to Dock" for persistence on Safari/Chrome. No paid accounts, no native Mac app. MacBook Safari must be tested on a real device (added to real-device checklist).

