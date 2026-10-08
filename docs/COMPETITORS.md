# COMPETITORS.md — Competitive Teardown
> Analysed: 2026-10-08. Based on public information only. No sign-ups under the owner's identity.

---

## Analysed Products

### 1. Teleparty (formerly Netflix Party)
- **Sync method:** Browser extension that hooks into the streaming service's video element and relays play/pause/seek via a relay server.
- **Who needs what:** Both users need the same streaming subscription (Netflix, Disney+, etc.) and the browser extension. No local files.
- **Mobile:** Extensions not available on mobile browsers; mobile not supported as host.
- **Pricing:** Free extension; the subscription service costs money.
- **Privacy:** The extension accesses the video page DOM. Teleparty's server sees activity metadata.
- **Subtitles:** Uses the streaming service's own subtitles — no generation, no local file support.
- **UX strength:** Works seamlessly for people already on a streaming service. Very low friction.
- **UX weakness:** Tied to a paid streaming subscription. Does not work with local files. No voice/video. Extension install required.
- **Gap Matinee fills:** Works with local files. No extension. Free. Generates subtitles. Private.

---

### 2. Syncplay
- **Sync method:** JSON over TCP. A central relay server broadcasts playback events (pause/play/seek) to all participants. Clients use mpv, VLC, MPC-HC, etc.
- **Who needs what:** Both people need the same local file and the Syncplay application installed (not a web app). Can self-host or use public servers.
- **Mobile:** No official mobile app; desktop-only.
- **Pricing:** Free, open-source (Apache 2.0).
- **Privacy:** Public servers see room IDs and timing metadata. Self-host for full privacy.
- **Subtitles:** Whatever the local player supports — no generation, no sharing.
- **UX strength:** Very stable protocol; works on any OS; low overhead; open-source and auditable.
- **UX weakness:** Requires desktop install; no web interface; no voice/video built-in; no subtitle generation; not mobile-friendly; setup is not "3 minutes to first movie."
- **Gap Matinee fills:** Browser-based (zero install). Mobile. Voice/video. Subtitle generation in EN/TH/ML.

---

### 3. Jellyfin SyncPlay
- **Sync method:** Server-side state machine within the Jellyfin media server; all clients stream from the shared server.
- **Who needs what:** A self-hosted Jellyfin server with the media files uploaded to it. Both users connect to that server.
- **Mobile:** Full mobile apps available (Android/iOS).
- **Pricing:** Free, open-source. Hosting the server costs money or resources.
- **Privacy:** Files are uploaded to a server the owner controls.
- **Subtitles:** Jellyfin handles subtitles from embedded tracks or sidecar files.
- **UX strength:** Professional quality; handles many users; good media library management.
- **UX weakness:** Requires server setup, port forwarding, and uploading the film (large file). Not zero-cost at scale. Not suitable for a quick couple's night.
- **Gap Matinee fills:** Zero server file upload. Zero infrastructure setup for the user. Free. Browser-based.

---

### 4. Discord Go Live / Watch Together
- **Sync method:** Screen sharing of a browser tab (Mode C equivalent). YouTube Watch Together uses an iFrame embedded in the Discord client.
- **Who needs what:** Discord account required. Screen sharing is desktop-only. YouTube mode requires both to have a YouTube account/access.
- **Mobile:** Can view shared screen; cannot share from mobile.
- **Pricing:** Free tier available; Go Live quality is limited without Nitro.
- **Privacy:** Discord sees all communication metadata.
- **Subtitles:** YouTube's own subtitles in Watch Together; no generation.
- **UX strength:** Already where young users are; no setup for existing Discord users.
- **UX weakness:** Requires accounts. Privacy concerns. Limited to YouTube or screen sharing. Poor subtitle support for local files. Not couple-first — built for groups.
- **Gap Matinee fills:** No account. Private. Local files. Generated subtitles. Couple-first warmth.

---

### 5. Watch2Gether / Kosmi-type virtual rooms
- **Sync method:** Relay a shared video URL (YouTube, Vimeo, Twitch embed). Some support local file upload to their own servers.
- **Who needs what:** Account usually required. Some require uploading the film to their server (privacy concern, bandwidth cost).
- **Mobile:** Generally works on mobile for streaming content; local file support is limited.
- **Pricing:** Free tier with ads; premium removes ads and adds features.
- **Privacy:** Video URLs or uploaded files pass through their servers.
- **Subtitles:** None generated; whatever the source provides.
- **UX strength:** Easiest for streaming content (YouTube etc.); no install.
- **UX weakness:** Film uploaded to their server breaks privacy. Ads on free tier. Account required. No generated subtitles. Not multilingual.
- **Gap Matinee fills:** No upload, no account, no ads, private, multilingual subtitles.

---

### 6. Rave (mobile app)
- **Sync method:** Syncs streaming services (Netflix, YouTube, Amazon Prime) via their iOS/Android apps.
- **Who needs what:** Mobile app install; streaming subscriptions.
- **Mobile:** Mobile-first (iOS/Android).
- **Pricing:** Free with ads; premium subscription removes ads.
- **Privacy:** Activity visible to Rave and the streaming services.
- **Subtitles:** Service's own subtitles.
- **UX strength:** Mobile-first; good UX for streaming services; voice/video built-in.
- **UX weakness:** Local files not supported. Requires a streaming subscription. Account required. No generated subtitles. Not multilingual.
- **Gap Matinee fills:** Local files. No subscription. No account. Multilingual subtitle generation.

---

### 7. Hyperbeam-type shared browsers
- **Sync method:** Cloud-rendered browser instance streamed to all participants (cloud VM approach).
- **Who needs what:** Account required; internet for the cloud VM.
- **Mobile:** View on mobile; cloud VM does the work.
- **Pricing:** Free tier very limited; paid plans for real use.
- **Privacy:** All browsing is through their cloud server.
- **Subtitles:** Whatever the browser shows.
- **UX strength:** Works for DRM content and any website.
- **UX weakness:** Expensive at scale. Latency from cloud VM. Not free for meaningful use. Privacy (all content through their servers).
- **Gap Matinee fills:** Free. Private. Local files. Generated subtitles. No cloud video routing.

---

## Positioning Statement

**Matinee fills a clear, unoccupied niche:**

Every existing solution is either (a) tied to paid streaming subscriptions, (b) requires uploading the film to a third-party server, (c) requires account sign-ups, or (d) provides no multilingual subtitle generation.

Matinee is the only tool designed specifically for:
- A couple with their own local film files
- Who are in different countries (possibly with strict networks)
- Who want private, E2EE communication
- Who can each read a different language (EN/TH/ML)
- That works free, from a browser, on desktop and mobile, with zero infrastructure setup

---

## "Steal the principle, not the code"

| Source | Principle to take | Implementation |
|--------|------------------|----------------|
| Syncplay | Playback-state relay is enough; no streaming required | Our sync-engine + data channel |
| Jellyfin SyncPlay | State machine with anchor-time + rate adjustments | Our drift controller (§8.5.3) |
| Teleparty | Ride the streaming service's quality | We: ride the local file's quality (Mode A) |
| Rave | Voice/video built-in alongside video | Our voice/video layer on top of the theatre |
| Syncplay (OSS) | Apache 2.0 — read and learn from the protocol; never paste code | Protocol inspiration only |
