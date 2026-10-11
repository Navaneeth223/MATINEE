# Matinee — Requirements Document

> Version: 0.2 (Gate A + CR-001) · Primary Mode: B (From Me) · Date: 2026-10-10

---

## Change Request CR-001 Applied

**Date:** 2026-10-10  
**Classification:** Major changes to core architecture and milestone plan

**Key Changes:**
1. Mode B (From Me) is now the MUST-have primary mode (moved to M3)
2. Partner likely does NOT have the film file
3. Owner: Windows laptop/PC + VLC; Partner: MacBook (Safari/Chrome)
4. Remote control added for partner in Mode B
5. Audio mixer with independent volume branches (Web Audio API)
6. Voice clarity features (mic/speaker picker, Opus mono 32-48 kbps)
7. Draggable+resizable face bubbles with snap-to-corners
8. Companion device support (laptop joins as camera+mic while PC sends movie)
9. "Cinema+" quality preset with upload speed detection
10. Mode C (screen share VLC) as fallback with explicit limitations

---

## 1. Overview

**Mission:** Matinee lets two people in different countries watch the same film together in perfect sync. The owner (host) streams video from their device to their partner's MacBook. Subtitles are generated and translated in the browser. They can talk while watching. The film never uploads to any server.

**Target users:** 
- **Owner:** Has a film file on Windows laptop/PC, plays it in VLC or browser
- **Partner:** MacBook (Safari or Chrome), likely does NOT have the film file
- Both may speak different languages

**Core value propositions:**
1. Film streams from owner to partner — no server upload, no storage
2. Subtitles generated locally (Whisper) and translated (Gemini BYOK)
3. Zero cost to start: all infrastructure runs on free tiers (no card until M5)
4. Partner has remote control in Mode B (play/pause/seek)
5. Independent audio mixing (movie volume vs voice volume)

---

## 2. Objectives (O1–O11)

| ID | Objective | User Story |
|-----|-----------|------------|
| O1 | Stream film from owner to partner (Mode B) | "As owner, I can play a film in my browser/VLC and stream it to my partner's MacBook in near-source quality." |
| O2 | Remote control for partner | "As partner, I can play/pause/seek the film, and the owner's player executes my commands." |
| O3 | Independent audio mixing | "As partner, I can adjust movie volume and voice volume independently without changing what the owner hears." |
| O4 | In-browser subtitle generation | "As owner, I can generate subtitles from the film's audio without installing anything." |
| O5 | Subtitle translation (EN→TH/ML) | "As a Thai or Malayalam speaker, I can read subtitles in my own language." |
| O6 | Subtitle sharing | "As the subtitle generator, my subtitles appear on my partner's screen too." |
| O7 | Voice calling with clarity features | "As a user, I can talk to my partner with mic/speaker selection, noise reduction, and level meters." |
| O8 | Draggable face bubbles | "As a user, I can see my partner's face in a draggable, resizable bubble that doesn't cover subtitles." |
| O9 | Companion device | "As owner, I can join my own session with my laptop as camera+mic while my PC sends the movie." |
| O10 | Cinema+ quality preset | "As owner, I can stream at near-source quality with automatic bitrate selection based on my upload speed." |
| O11 | MacBook web-only experience | "As partner on MacBook, I can use Safari or Chrome with PWA 'Add to Dock' for persistence." |

---

## 3. Functional Requirements

### Room & Session (FR-100s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-101 | Create Room | Owner clicks "Create room"; system generates unique room ID and shareable URL. No account required. | P0 | M1 |
| FR-102 | Join Room | Partner opens share URL; connects via WebSocket. Max 2 peers per room. | P0 | M1 |
| FR-103 | Room Expiry | Rooms with no activity for 30 minutes are cleaned up (Durable Object alarm). | P1 | M1 |
| FR-104 | Reconnect | If a peer disconnects, client retries with exponential back-off; room state preserved 5 min. | P1 | M1 |
| FR-105 | Companion Device Join | Owner's laptop joins the same room as camera+mic using QR code or 6-digit code. Simple version first. | P1 (Should) | M4 |

### Mode B: From Me (FR-200s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-201 | Capture Local Video | Owner's browser captures video from `<video>` element playing local file using HTMLMediaElement.captureStream(). | P0 | M3 |
| FR-202 | Stream to Partner | Captured video stream sent to partner via WebRTC MediaStream. | P0 | M3 |
| FR-203 | Video Display | Partner's MacBook displays received video in `<video>` element at received resolution. | P0 | M3 |
| FR-204 | Remote Control: Play/Pause | Partner can play/pause; command sent via WebSocket; owner's player executes it. | P0 | M3 |
| FR-205 | Remote Control: Seek | Partner can seek/scrub timeline; owner's player jumps to requested timestamp. | P0 | M3 |
| FR-206 | Remote Control: ±10s | Partner can skip forward/back 10 seconds via hotkeys. | P1 | M3 |
| FR-207 | Cinema+ Quality Preset | Maintain source resolution, detect upload speed, cap bitrate at ~70% of measured upload, 1.5-3s playout delay, H.264 when Safari viewer. | P0 | M3 |
| FR-208 | Upload Speed Detection | Doctor measures upload speed and recommends bitrate preset. Honest limit shown: "near-source, not lossless". | P0 | M3 |
| FR-209 | Safari Compatibility | When partner uses Safari, force H.264 codec (not VP9). | P0 | M3 |
| FR-210 | Symmetric Role Switching (CR-002) | Either peer may act as the video source (sender) for Mode B. The sender and receiver have the same playback controls: volume, pause, seek, scrub, plus/minus 10 s. Role switching happens at session start (not mid-session in v1). Safari constraint: Safari cannot send. If the user's browser is Safari, the UI disables the Send option and shows: "Use Chrome or Firefox to send. Safari can only receive." | P0 | M3 |

### Mode C: Screen Share Fallback (FR-250s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-251 | Screen Share VLC | Owner uses getDisplayMedia to share entire screen with VLC playing film. | P2 | M4 |
| FR-252 | No Remote Control in Mode C | UI explicitly states: "In Screen Share mode, remote control is not available. Only you can control playback." | P2 | M4 |
| FR-253 | Format Doctor Mode C Tips | Doctor offers Mode C and shows tips: Focus Assist/Do Not Disturb, share entire screen for audio, no remote control. | P2 | M4 |
| FR-254 | Spike: Volume Passthrough | Test whether lowering owner's Windows volume lowers audio partner hears in Mode C. Document in spikes/. | P2 | Before M4 |

### Audio Mixer (FR-300s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-301 | Movie Volume Control | Slider 0-100%, separate for each peer. Includes Boost to 300% with soft limiter. | P0 | M3 |
| FR-302 | Partner Voice Volume | Slider for partner's voice, independent from movie volume. | P0 | M5 |
| FR-303 | My Mic Gain | Slider for local mic input gain. | P0 | M5 |
| FR-304 | Mute Buttons | Mute movie, mute partner, mute self. Always visible in mixer. | P0 | M5 |
| FR-305 | Independent Audio Branches | Web Audio API creates separate gain nodes: movie, partner voice, local voice. Changing one does NOT affect what partner hears. | P0 | M5 |
| FR-306 | Mixer Always One Tap Away | Mixer accessible from Theatre page via single tap/click. Keyboard shortcut (M). | P0 | M5 |
| FR-307 | Remember Settings Per Device | Audio settings saved to localStorage per device. | P1 | M5 |
| FR-308 | Audio Ducking | When partner speaks, movie volume automatically reduces by 40% (§8.10). Toggle on/off. | P1 | M5 |

### Voice Clarity (FR-350s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-351 | Mic/Speaker Picker | Dropdown lists available audio input/output devices. | P0 | M5 |
| FR-352 | Echo Cancellation Toggle | Enable/disable browser AEC (acoustic echo cancellation). | P1 | M5 |
| FR-353 | Noise Suppression Toggle | Enable/disable browser noise suppression. | P1 | M5 |
| FR-354 | Level Meter | Real-time VU meter showing mic input level. | P1 | M5 |
| FR-355 | Test Tone | Play test tone to verify audio routing. | P2 | M5 |
| FR-356 | Opus Mono Voice | Voice encoded as Opus mono 32-48 kbps (negotiable). | P0 | M5 |
| FR-357 | Voice Clarity EQ (Optional) | Optional EQ preset to boost vocal frequencies (1-4 kHz). | P2 | M5 |

### Face Bubbles (FR-400s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-401 | Draggable Face Bubble | Partner's video feed displayed in draggable overlay. | P0 | M5 |
| FR-402 | Resizable | Resize handles + S/M/L quick-size buttons. | P0 | M5 |
| FR-403 | Shape: Circle or Square | Toggle between circular and square mask. | P1 | M5 |
| FR-404 | Snap to Corners | Bubble snaps to screen corners when dragged near edge. | P1 | M5 |
| FR-405 | Lock Position | Lock icon prevents accidental dragging. | P1 | M5 |
| FR-406 | Opacity Control | Slider 20%-100% opacity. | P2 | M5 |
| FR-407 | Hide Bubble | Hide button removes video overlay entirely (audio continues). | P1 | M5 |
| FR-408 | Stay Inside Fullscreen | Bubble remains visible and functional when video goes fullscreen. | P0 | M5 |
| FR-409 | Never Cover Subtitles | Bubble positioned to avoid default subtitle position. Smart auto-reposition if subtitles appear underneath. | P0 | M5 |

### Subtitle Generation (FR-500s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-501 | Audio Extraction | Extract primary audio track from local file using WebCodecs or ffmpeg.wasm. | P0 | M2 |
| FR-502 | Whisper Transcription | Whisper-tiny (or small) runs in-browser via @huggingface/transformers; generates SRT cues. | P0 | M2 |
| FR-503 | Subtitle Display | Generated or loaded SRT/VTT cues rendered as styled overlays on video. | P0 | M2 |
| FR-504 | Subtitle Sharing | Generating peer sends subtitle cues to room via WebSocket (E2EE after M4). | P0 | M2 |
| FR-505 | Model Selection | User chooses Whisper model size (tiny/base/small); UI shows download size. | P1 | M2 |
| FR-506 | Manual SRT/VTT Import | User can load pre-existing subtitle file. | P1 | M2 |
| FR-507 | Generation Progress | Progress bar shows Whisper processing status (% of audio). | P1 | M2 |

### Translation (FR-600s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-601 | EN→TH/ML Translation | English subtitles translated to Thai or Malayalam via Gemini API (BYOK). | P0 | M3 |
| FR-602 | BYOK API Key | User enters Gemini API key in settings; stored in localStorage (E2EE storage after M4). | P0 | M3 |
| FR-603 | Translation Caching | Translated cues cached in IndexedDB. | P1 | M3 |
| FR-604 | Dual-Language Display | Show both original and translated subtitles simultaneously. | P1 | M3 |

### End-to-End Encryption (FR-700s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-701 | Key Exchange | Peers exchange ECDH keys during room join; derive shared AES-GCM-256 session key. | P0 | M4 |
| FR-702 | Message Encryption | All room messages (sync events, subtitles, chat) encrypted before leaving browser. | P0 | M4 |
| FR-703 | No Server Plaintext | Cloudflare Worker relays encrypted blobs only; never sees plaintext. | P0 | M4 |

### Internationalisation (FR-800s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-801 | EN/TH/ML UI | All UI strings available in English, Thai, and Malayalam. | P0 | M3 |
| FR-802 | Font Loading | Noto Sans Thai and Noto Sans Malayalam loaded from Google Fonts or bundled. | P0 | M3 |

### Watch-along Mode (FR-950s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-950 | Watch-along Mode (CR-002) | Each person plays their own copy of a streaming service (Netflix, etc.) independently. Matinee provides voice/video overlay, a shared 3-2-1 countdown start, and a pause-together alert. Matinee does NOT capture, relay, or synchronise the video stream. | P2 (Should) | M8/M9 |
| FR-951 | Independent Playback | Each participant plays content on their own device/subscription independently. | P2 | M8/M9 |
| FR-952 | Shared 3-2-1 Countdown | Both clients display a countdown and start playing simultaneously on 1. | P2 | M8/M9 |
| FR-953 | Pause Together Alert | If one person pauses, the other sees a notification. No enforcement; no DRM bypass. | P2 | M8/M9 |
| FR-954 | Voice/Video Overlay | Face bubbles, voice, and mixer features work during Watch-along. | P2 | M8/M9 |
| FR-955 | No Remote Control in Watch-along | Each person controls their own player. No remote control commands sent. | P2 | M8/M9 |

**Constraint:** Each person must have their own subscription. No DRM bypass. No video capture or relay of streaming content.

### Together Mode (Deferred) (FR-900s)

| ID | Title | Description | Priority | Milestone |
|----|-------|-------------|----------|-----------|
| FR-901 | Local File Both Peers | Both peers load same file locally; sync playback via WebSocket. | P2 (Should) | After M5 |
| FR-902 | Sync Play/Pause | When one peer plays/pauses, other mirrors within 500 ms. | P2 | After M5 |
| FR-903 | Sync Seek | When one peer seeks, other jumps to same timestamp within 500 ms. | P2 | After M5 |
| FR-904 | Drift Correction | If positions diverge >1s, lagging peer re-syncs. | P2 | After M5 |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement | Target | Milestone |
|----|----------|-------------|--------|-----------|
| NFR-01 | Performance | Largest Contentful Paint (LCP) on desktop Chrome | < 2.5 s on 10 Mbps | M1 |
| NFR-02 | Performance | WebRTC video stream latency (Mode B) | < 3 s playout delay at Cinema+ | M3 |
| NFR-03 | Performance | Remote control command latency | < 300 ms round-trip (WebSocket) | M3 |
| NFR-04 | Performance | Whisper-tiny inference (10-min audio, WASM) | < 5 min on mid-tier laptop | M2 |
| NFR-05 | Performance | Whisper-tiny inference (10-min audio, WebGPU) | < 90 s on GPU device | M2 |
| NFR-06 | Performance | Translation API p95 latency per 100 cues | < 8 s (Gemini Flash) | M3 |
| NFR-07 | Security | No film bytes uploaded to server | Verified by network inspection | All |
| NFR-08 | Security | All room messages E2EE | AES-GCM-256 key never leaves browser | M4 |
| NFR-09 | Security | HTTPS only | Strict-Transport-Security header | M1 |
| NFR-10 | Accessibility | WCAG 2.2 AA for interactive elements | axe-core zero critical violations | M2 |
| NFR-11 | Accessibility | Subtitle contrast ratio | ≥ 4.5:1 (text on video overlay) | M2 |
| NFR-12 | Browser Support | Owner: Windows Chrome/Edge 120+ | Core features work | M1 |
| NFR-13 | Browser Support | Partner: MacBook Safari 17+ or Chrome 120+ | Core features work | M3 |
| NFR-14 | Browser Support | Mobile: iOS Safari 17+, Android Chrome 120+ | Core features work | M5 |
| NFR-15 | Free Tier | M1–M4 operate with zero payment card requirements | Verified per FREE-TIER-LEDGER.md | M1 |
| NFR-16 | Video Quality | Cinema+ maintains source resolution; bitrate ~70% of upload | Measured by owner's bandwidth test | M3 |
| NFR-17 | Video Quality | H.264 used when Safari viewer detected | Codec negotiation logged | M3 |

---

## 5. Acceptance Tests

### AT-201: Mode B Video Streaming (FR-201, FR-202, FR-203)

**Given** owner has loaded an MP4 file in browser video element,  
**When** owner starts Mode B session and partner joins,  
**Then** partner's MacBook displays the video stream within 3 seconds at source resolution (or close), with continuous playback and no freezing.

### AT-204: Remote Control Play/Pause (FR-204)

**Given** owner is streaming video in Mode B and partner is watching,  
**When** partner clicks pause button,  
**Then** owner's video element pauses within 300 ms, and partner's stream freezes within 500 ms of command.

### AT-205: Remote Control Seek (FR-205)

**Given** owner is streaming video in Mode B,  
**When** partner drags timeline to 00:05:00,  
**Then** owner's player jumps to 00:05:00 within 300 ms, and partner's stream shows 00:05:00 (±2 s) within 1 second.

### AT-301: Independent Audio Mixing (FR-301, FR-305)

**Given** both peers are in a call with movie playing,  
**When** partner lowers movie volume slider to 30%,  
**Then** partner hears movie at 30% but owner hears movie at their own volume setting (unchanged).

### AT-401: Draggable Face Bubble (FR-401, FR-408, FR-409)

**Given** both peers are in video call in Theatre,  
**When** partner drags face bubble to bottom-right corner and enters fullscreen,  
**Then** bubble stays visible in corner, does not cover subtitle area, and remains draggable in fullscreen.

### AT-502: Whisper Subtitle Generation (FR-501, FR-502, FR-503, FR-504)

**Given** owner has loaded film and initiated subtitle generation,  
**When** Whisper finishes processing,  
**Then** subtitle cues appear on owner's video, and same cues appear on partner's video via FR-504.

### AT-601: Gemini Translation (FR-601, FR-602)

**Given** user has entered valid Gemini API key and English subtitles loaded,  
**When** user selects "Translate to Thai",  
**Then** Thai subtitle cues appear within 10 s for 10-cue track.

### AT-701: E2EE Message Flow (FR-701, FR-702, FR-703)

**Given** two peers connected with E2EE active (M4),  
**When** owner sends sync event,  
**Then** network inspection shows encrypted blob; Cloudflare Worker logs show no plaintext.

### AT-351: Mic/Speaker Picker (FR-351)

**Given** user opens audio settings in Theatre,  
**When** user clicks mic picker dropdown,  
**Then** all available audio input devices listed; selecting one changes active mic.

---

## 6. Milestone Mapping (Revised per CR-001 and CR-002)

**Milestone Plan (revised per CR-001 and CR-002):**

| Milestone | Goal | Key Deliverables | Free-Tier Constraint |
|-----------|------|-----------------|---------------------|
| **M1** | **Foundation** | Monorepo scaffold, CI, dev tooling. Status: Done. | No costs |
| **M2** | **Rooms + E2EE + Presence + Invite** | Room creation, E2EE key exchange, presence indicators, invite links. E2EE before any messaging. | Cloudflare Workers + DO free tier; no card |
| **M3** | **From Me Core + Remote Control** | Mode B WebRTC video share, receiver remote control (pause/seek/±10s), two-network STUN test, TURN decision. Primary mode; symmetric roles (FR-210). | Gemini BYOK; no platform cost |
| **M4** | **Theatre UI + Mixer + Face Bubbles** | Full Theatre layout, audio Mixer (movie/voice/mic, boost to 300%, ducking), draggable and resizable face bubbles. | Cloudflare DO storage; no additional cost |
| **M5** | **Voice/Video + Companion Device + Doctor** | Voice clarity settings, companion device (QR join), Format Doctor, Cinema+ preset. TURN relay confirmed here if needed. | TURN relay provider TBD; card requirement verified before this milestone |
| **M6** | **Subtitles v1** | Load and display SRT/VTT files, subtitle styling, position controls. Display only, no generation. | No costs |
| **M7** | **Subtitle Generation (EN/TH/ML)** | Whisper-based subtitle generation for English, Thai, Malayalam. | Cloudflare free; Whisper runs in browser |
| **M8** | **Together Mode** | Both-have-file mode, local sync without relay, shared playback. No relay needed. | Cloudflare DO WebSocket; no relay cost |
| **M9** | **Share Screen + VLC Fallback** | getDisplayMedia screen share, VLC audio capture tips, Format Doctor Mode C guidance. | No costs |
| **M10** | **Mobile/PWA Polish** | PWA manifest, Safari Add to Dock, mobile layout, responsive Theatre UI. | No costs |
| **M11** | **Security Hardening** | Penetration review, E2EE audit, rate limiting, CSP headers. | No costs |
| **M12** | **Release** | Final QA, documentation, public launch. | No costs |

**Watch-along mode (FR-950-955) targets M8 or M9 based on M7 velocity.**

---

## 7. Out of Scope

Explicitly **not** in scope for any milestone:

- User accounts, authentication, or persistent profiles
- Server-side storage of film files
- DRM-protected content (Widevine, FairPlay, PlayReady)
- Live streaming or broadcast watch parties
- Group watch with >2 simultaneous viewers
- Monetisation, subscriptions, paid tiers
- Native mobile apps (iOS/Android app store)
- Subtitle styling beyond basic overlays
- Automatic content identification or rights verification
- Screen recording or capture of watch session
- Accessibility beyond WCAG 2.2 AA basics
- Video quality beyond "near-source" (not lossless encoding)
- Multiple companion devices (limit: 1 companion per seat)
- Netflix-specific browser sync extension (logged as v1.1 candidate; not a v1 requirement)

---

*End of REQUIREMENTS.md v0.2 (CR-001)*
