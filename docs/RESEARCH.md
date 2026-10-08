# RESEARCH.md — Phase 0 Research Findings
> Reference date: 2026-10-08. Re-verify any fact older than 12 months before acting on it.
> Confidence: high = primary source + cross-checked | medium = single primary source | low = community reports only.

---

## GROUP A — FREE INFRASTRUCTURE

### RQ-01 — Cloudflare Workers + Durable Objects (free plan)
- **Question:** Daily request caps, WebSocket accounting, DO duration/storage, CPU limits, card requirement?
- **Answer:** Workers free: 100,000 requests/day (shared across all scripts + DOs); 10 ms CPU per invocation. DO free: 100,000 req/day (shared with Workers), 13,000 GB-seconds compute/day, 5 GB SQLite storage. Limits reset at 00:00 UTC. At the limit, operations fail (Error 1027 for Workers). No card required to sign up.
- **Evidence:** Cloudflare Workers pricing docs, accessed 2026-10-08. Multiple search sources agree.
- **Confidence:** high
- **Estimate for a film night:** Two peers connect, ping every 20 s, exchange ~10 control messages during foyer, ~1 message/min during film (2 h) = ~150 messages round-trip per film night per room. Well within 100k/day.
- **Impact on design:** DO free quota is the shared pool. Quota guard must fire at ~70k (warn) / 90k (refuse new rooms). Hibernation API is mandatory to avoid billing idle duration.
- **Fallback if wrong:** Node WS fallback server (RQ-06).
- **Owner action needed:** None at this stage.

---

### RQ-02 — Cloudflare Realtime TURN (free)
- **Question:** Free quota, credential API, card requirement, terms of use?
- **Answer:** 1,000 GB/month free (shared pool for TURN + SFU together). Overage billed at $0.05/GB. **A credit card (payment method) IS required** to enable Cloudflare Realtime. TURN traffic between CF Realtime TURN and CF Realtime SFU is not charged (but we are not using the SFU). TTL/credentials via the CF Realtime credentials API.
- **Evidence:** cloudflare.com/products/realtime pricing page, accessed 2026-10-08.
- **Confidence:** high
- **Stop-the-line flag:** Card required. Owner must decide before M1 deployment. Tell the owner plainly: "Enabling Cloudflare Realtime TURN requires adding a credit card to Cloudflare. Usage under 1,000 GB/month will not cost money, but a card is required. Alternatives exist (see RQ-04)."
- **Estimate:** A 2-hour film streamed via Mode B at 3 Mbps uses 2.7 GB of relay. Personal use = a few films per month = well under 1,000 GB/month.
- **Impact on design:** TURN credentials endpoint (/api/ice) is mandatory; card-requirement must be disclosed and confirmed by owner before setup.
- **Fallback if wrong / card declined:** Use Open Relay (open-relay.metered.ca) or self-hosted coturn (RQ-04).

---

### RQ-03 — Public STUN servers
- **Question:** Reliable free STUN servers with stated terms?
- **Answer:**
  - Primary: `stun.cloudflare.com:3478` (Cloudflare; no stated terms, implied free service)
  - Backup: `stun.l.google.com:19302` (Google; no stated explicit terms; widely relied on)
  - Tertiary: `stun1.l.google.com:19302`
- **Evidence:** Standard WebRTC references; no official "terms" doc for STUN-only; both widely used in production apps.
- **Confidence:** medium (terms unverified; usage is convention)
- **Impact on design:** Both listed in ICE config. Failure of one STUN server does not break TURN; STUN is best-effort.
- **Fallback:** Add a fourth from coturn's public demo list if both primary servers show reliability issues.

---

### RQ-04 — Free TURN alternatives
- **Question:** Alternative TURN sources, card requirements?
- **Answer:**
  - **open-relay.metered.ca:** Community TURN; free tier available; no credit card required; bandwidth-limited; suitable for low-volume personal use. Quality/uptime not guaranteed.
  - **Self-hosted coturn on a free VM:** Google Cloud free tier (1 e2-micro) or Oracle Always-Free (2 Ampere VMs, 200 GB bandwidth). Oracle requires a credit card for sign-up (billing protection); Google free tier also requires a card. Coturn itself is Apache-licensed. Self-hosting gives full control but requires maintenance.
- **Evidence:** Metered TURN public docs; Oracle/GCP free tier pages (card requirement from community reports — not primary-source verified for Oracle).
- **Confidence:** medium
- **Impact on design:** open-relay.metered.ca is the card-free TURN fallback if the owner chooses not to add a card to Cloudflare. Self-hosting is an option the owner can approve at Gate A or later.
- **Owner action needed:** At Gate A, owner chooses: (a) add card to Cloudflare Realtime [best] or (b) use Metered TURN [no card, lower quality].

---

### RQ-05 — Static hosting (Cloudflare Pages free)
- **Question:** File size limits, header support, bandwidth?
- **Answer:** Max file size per asset: **25 MiB**. Max file count: 20,000. Bandwidth for static assets: unlimited (no cap). Pages Functions (API routes within Pages) count toward Workers quotas. Build limit: 500/month, 20 min max. Custom `_headers` file supported for setting CSP, CORP, etc.
- **Evidence:** cloudflare.com/pages pricing, accessed 2026-10-08.
- **Confidence:** high
- **Critical implication:** WASM files (e.g. ffmpeg.wasm core ~7 MB, transformers.js ONNX runtime), and ML model weights (whisper-small ONNX ~500 MB) CANNOT be hosted on Cloudflare Pages. They must be fetched directly from Hugging Face or loaded from Cache Storage. This is actually the right pattern (user consents and downloads once, cached locally).
- **Decision (ADR-0003):** Use a single Cloudflare Worker that serves both static assets and the /api/* routes via the Workers Assets binding. This avoids Pages entirely for the Worker API while keeping hosting simple.
- **Fallback:** GitHub Pages for static assets (but does not support custom headers — CSP cannot be set, which is a security issue). Vercel/Netlify free tiers support headers but have bandwidth caps. CF Worker + Assets is the best choice.

---

### RQ-06 — Fallback signaling host
- **Question:** Card-free Node WS host for DO fallback?
- **Answer:**
  - **Render.com:** Free tier for Node web services. Known issue: free services spin down after 15 minutes of inactivity (cold start ~30 s). Not suitable as the primary signaling host but usable as an emergency fallback where the 30 s delay on first connect is explained to the user.
  - **Koyeb:** Similar free tier. Smaller cold-start footprint.
- **Confidence:** medium (cold-start times from community reports, not primary source)
- **Impact on design:** The `SignalingTransport` interface is abstracted so swapping is a config change (VITE_SIGNALING_URL). The Node WS server will be under 200 lines and kept in `apps/edge/fallback-ws/`.
- **Owner action needed:** Only needed if DO quota issues arise. Not needed at M1.

---

### RQ-07 — Bot protection (Cloudflare Turnstile)
- **Question:** Free? Privacy? Card required?
- **Answer:** Turnstile free tier: unlimited requests, 20 widgets, no credit card required. Privacy: processes minimal signals, no ad tracking, marketed as GDPR/CCPA-friendly. Suitable for protecting room creation from spam bots.
- **Evidence:** cloudflare.com/products/turnstile, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Add Turnstile to `POST /api/rooms` as an optional guard behind a feature flag `FEATURE_TURNSTILE`. Default: enabled on staging, disabled for local dev.

---

## GROUP B — REAL-TIME MEDIA

### RQ-08 — HTMLMediaElement.captureStream() support matrix
- **Question:** Which browsers support it? Mobile?
- **Answer:**
  | Browser | Support |
  |---------|---------|
  | Chrome desktop | Yes |
  | Chrome Android | Yes |
  | Firefox desktop | Yes (as `mozCaptureStream` also) |
  | Safari desktop/iOS | **NO** |
- Not a "Baseline" feature. Safari does not support it as of 2026-10-08.
- The canvas workaround (draw frames to canvas, call `canvas.captureStream()`) works in Safari but loses audio and has performance cost.
- **Evidence:** MDN browser-compat-data, caniuse, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Mode B host is NOT available on Safari (desktop or iOS). The UI hides the "From Me" host option on Safari with a plain explanation.

---

### RQ-09 — getDisplayMedia support and audio
- **Question:** Mobile support? System audio capture?
- **Answer:** `getDisplayMedia()` is **not supported** on any mobile browser (iOS or Android Chrome) as of 2026-10-08. This is a platform-level restriction, not a browser choice. On desktop: Chrome/Edge support systemAudio on Windows/ChromeOS; macOS is tab-audio only; Firefox and Safari generally provide no system audio. All stated options (selfBrowserSurface, preferCurrentTab, displaySurface) confirmed in Chrome and Edge.
- **Evidence:** MDN, developer community reports, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Mode C (Share Screen) host = desktop-only. Mobile users see: "Phones can watch a shared screen but can't share one. Use Together mode instead." Pre-share coaching card needed for audio selection.

---

### RQ-10 — WebRTC best practices for movie streaming
- **Question:** Perfect negotiation, bitrate control, codecs, Opus settings?
- **Answer:** Standard "perfect negotiation" pattern (polite/impolite, makingOffer, ignoreOffer) is the canonical approach per W3C WebRTC spec. `setCodecPreferences` and `RTCRtpSender.setParameters` are widely supported in Chromium/Firefox. Codec order: H.264 (hardware HW) preferred on mobile/Apple silicon, VP9 as quality fallback on Chromium desktop, VP8 as last resort. Opus stereo: `stereo=1; sprop-stereo=1; maxaveragebitrate=192000; useinbandfec=1` via minimal SDP munging. `contentHint: 'motion'` for video, `'music'` for audio are supported in Chrome/Firefox.
- **Evidence:** W3C WebRTC spec; MDN; browser vendor docs; accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Implement exact perfect-negotiation pattern from spec. Keep SDP munging in one isolated tested function.

---

### RQ-11 — requestVideoFrameCallback support
- **Question:** Which browsers? What metadata?
- **Answer:** `requestVideoFrameCallback` (rVFC): supported in Chrome, Edge, Safari (since 15.4). Firefox: **not natively supported** as of 2026-10 — falls back to `requestAnimationFrame` + `currentTime`. Metadata includes `mediaTime`, `presentedFrames`. For WebRTC frames: `captureTime`, `receiveTime`, `rtpTimestamp` are available in Chrome. Safari provides basic metadata.
- **Evidence:** MDN browser compat data, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Use rVFC where available; polyfill with rAF+currentTime for Firefox. Firefox subtitle timing degrades gracefully. Mention in docs/TESTING.md.

---

### RQ-12 — Mobile platform capabilities
- **Question:** iOS Safari and Android Chrome specifics?
- **Answer (key findings):**
  - `playsinline` is mandatory on all iOS video elements.
  - Element Fullscreen API: not supported on iPhone Safari (iPad OK). Pseudo-fullscreen via CSS `inset: 0; height: 100dvh` is the workaround.
  - Wake Lock: supported on iOS 16.4+, Android Chrome.
  - File System Access API: not supported on iOS Safari (use `<input type=file>`).
  - Background audio/video: iOS suspends media in background tabs; PWA installed version is more lenient.
  - `navigator.vibrate`: Android Chrome only; iOS has no API.
  - Web Share (`navigator.share`): both platforms support it in recent versions.
  - `prefers-color-scheme`, `prefers-reduced-motion`: both platforms.
- **Evidence:** MDN, iOS WebKit release notes, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Every mobile-specific behaviour maps to the capabilities.ts report.

---

### RQ-13 — Container/codec compatibility
- **Question:** Which containers/codecs play in which browsers?
- **Answer:**
  | Format | Chrome | Firefox | Safari | Notes |
  |--------|--------|---------|--------|-------|
  | MP4/H.264/AAC | Yes | Yes | Yes | Universal safe choice |
  | WebM/VP9/Opus | Yes | Yes | Yes (recent) | Good choice |
  | MKV | Chrome (limited) | Yes | No | Problematic |
  | HEVC/H.265 | HW only (Windows) | No | Yes (HW) | Not reliable cross-browser |
  | AV1 | Yes (SW/HW) | Yes | Yes (recent) | Growing support |
  | AC-3/E-AC-3 (Dolby) | No | No | HW decode (macOS/iOS) | Widely incompatible |
  | DTS | No | No | No | Not web-compatible |
- **Impact on design:** Format Doctor shows ffmpeg remux recipes. Default recommendation: MP4 H.264 + AAC.

---

## GROUP C — SUBTITLES AND LANGUAGE

### RQ-14 — Existing subtitle sources
- **Question:** OpenSubtitles, SubDL — APIs, rate limits, terms?
- **Answer:**
  - **OpenSubtitles.com REST API:** The legacy XML-RPC API is shut down. New REST API requires an API key from the developer's OS account. Free tier: ~5 downloads/day anonymous; higher with authenticated user account. Rate limit: ~5 req/s. Returns results by movie hash, IMDB ID, or title. Attribution required. Must use official endpoints; scraping forbidden.
  - **SubDL:** Less well-known; has a free API; limits not precisely documented from primary source. Lower confidence.
- **Evidence:** opensubtitles.stoplight.io docs, accessed 2026-10-08.
- **Confidence:** medium (OS limits from docs; SubDL low confidence)
- **Impact on design:** OpenSubtitles is opt-in, BYOK, cached by file fingerprint. Daily limit shown in the UI. Community subtitles are a bonus, never a dependency. SubDL listed as optional secondary.

---

### RQ-15 — Embedded subtitle extraction in browser
- **Question:** Libraries for MP4 and Matroska embedded text tracks?
- **Answer:**
  - **mp4box.js** (MIT license): Parses MP4 files; extracts `tx3g` / `mov_text` text tracks. Widely used; maintained; browser-compatible.
  - **Matroska:** `matroska-subtitles` npm package (MIT) for MKV/WebM embedded SRT/ASS tracks. Alternative: a small custom EBML parser (~150 lines) to avoid a dependency.
  - **Image-based subtitles (PGS/VobSub):** Not feasible in the browser without OCR. Out of scope; the Format Doctor explains this.
- **Confidence:** high
- **Impact on design:** Use mp4box.js for MP4; evaluate `matroska-subtitles` vs custom EBML in spike S2.

---

### RQ-16 — Audio extraction in browser for large files
- **Question:** WebCodecs AudioDecoder vs ffmpeg.wasm for large files?
- **Answer:**
  - **WebCodecs `AudioDecoder`:** Supported in Chrome/Edge/Firefox. Not on older Safari (partial in recent Safari). Streams audio without copying the full file to memory. Primary path.
  - **ffmpeg.wasm:** Available in single-threaded (no SharedArrayBuffer, no COEP required) and multi-threaded (requires COEP+COOP — complicates CSP and third-party resources). Single-thread build is ~8 MB gzip. Memory ceiling on phones is a real concern. Used only as a fallback for codecs WebCodecs cannot decode (AC-3, DTS, FLAC in MKV).
  - **License:** ffmpeg.wasm bundles ffmpeg libraries under LGPL. The LGPL requires dynamic linking or source availability if modified. The npm package `@ffmpeg/ffmpeg` is MIT; the bundled `@ffmpeg/core` is LGPL. Must document in LICENSES.md.
- **Confidence:** high (WebCodecs path); medium (ffmpeg.wasm memory ceiling on phones — needs spike S2)
- **Impact on design:** WebCodecs primary; ffmpeg.wasm lazy-loaded only on unsupported codec detection. Use single-thread build. Memory limits enforced with explicit ceiling checks.

---

### RQ-17 — In-browser Whisper (transformers.js)
- **Question:** Package name, version, WebGPU status, model sizes?
- **Answer:**
  - **Package:** `@huggingface/transformers` (replaces old `@xenova/transformers`). Current: v4.x.
  - **WebGPU:** Now broadly supported (Chrome 113+, Firefox 141+, Safari 26+). On mid laptop with GPU, Whisper inference is 3–20x faster than WASM. WebGPU uses a rewritten C++ runtime in v4.
  - **Model IDs (ONNX, from Hugging Face):** `onnx-community/whisper-tiny` (~39 MB), `whisper-small` (~244 MB), `whisper-medium` (~769 MB), `openai/whisper-large-v3-turbo` (~809 MB).
  - **Chunking:** Use `chunk_length_s=30, stride_length_s=5, return_timestamps=true`.
  - **Known issues:** Hallucinations on silence/music; repetition loops. Mitigations: VAD pre-filtering, no-speech probability checks, repetition detection (all in §9.5.4).
- **Evidence:** Hugging Face docs, npm registry, accessed 2026-10-08. WebGPU support from caniuse/MDN cross-referenced.
- **Confidence:** high
- **Impact on design:** Package is `@huggingface/transformers`. Device-tier-based model selection. Both WebGPU and WASM paths tested.

---

### RQ-18 — Whisper accuracy for Malayalam and Thai
- **Question:** WER for these languages?
- **Answer:** No standardised public benchmark exists for Malayalam Whisper WER as of 2026-10. Community findings: Malayalam is a low-resource language in Whisper's training data. Out-of-the-box Whisper (small/medium) shows materially higher WER than English — roughly 2–4x higher WER on real-world film dialogue (estimated from research reports; not a rigorous benchmark). Fine-tuning on Malayalam data improves accuracy significantly but is out of scope for the app. Thai is similarly limited. For both languages, base Whisper may still produce useful transcriptions for well-produced films with clear dialogue, but the output requires human review.
- **Evidence:** Research papers, industry blogs, accessed 2026-10-08. Low-confidence without a formal benchmark.
- **Confidence:** low (no standardised benchmark)
- **Impact on design:** Critical rule (Law 12): label all ML-generated tracks; show a persistent banner for Thai and Malayalam: "Speech recognition for this language is still imperfect. Please review the flagged lines." The §9.4 routing logic strongly prefers finding existing human-authored subtitles before triggering STT for these languages.
- **Owner action needed:** For the owner's own Malayalam-audio films, existing community subtitles should almost always exist and be tried first. STT is a last resort.

---

### RQ-19 — Free cloud STT accelerators
- **Question:** Groq, Cloudflare Workers AI — free limits, privacy?
- **Answer:**
  - **Cloudflare Workers AI (Whisper):** 10,000 neurons/day free. Audio limit per request: 2 MB. A 30 s audio chunk at 16 kHz mono (compressed Opus at ~32 kbps) ≈ ~120 KB, so the limit allows many chunks per request. Beyond 10k neurons: $0.011/1k neurons.
  - **Groq:** Hosts Whisper (various sizes) on a free tier with rate limits (RPM/RPD; check current limits at console.groq.com). Groq processes audio on their hardware; consent dialog required.
  - **Privacy:** Cloudflare and Groq free tiers may use request data for improvement. This MUST be disclosed and consent obtained before any audio chunk is sent.
- **Evidence:** cloudflare.com/workers-ai pricing, accessed 2026-10-08. Groq limits from their console (low confidence — not primary-source-verified today).
- **Confidence:** medium
- **Impact on design:** Both are optional, off by default, BYOK. A consent dialog naming the provider runs before first use per film. Audio is chunked below the 2 MB limit. Neuron budget tracked client-side.

---

### RQ-20 — Machine translation to Thai and Malayalam
- **Question:** Gemini free tier, NLLB-200, other options?
- **Answer:**
  - **Gemini free tier (Google AI Studio BYOK):** Available. Current models include `gemini-3.5-flash`, `gemini-3.8-flash`. Rate limits: RPM/RPD vary by model; check AI Studio dashboard. **Data-use terms (free tier): prompts may be used by Google to improve products.** This is disclosed in the consent dialog. Best context handling; best Thai/Malayalam naturalness in early evaluations (to be confirmed in spike S4).
  - **NLLB-200 (facebook/nllb-200-distilled-600M):** License = **CC-BY-NC 4.0** (non-commercial only). Appropriate for private personal use; must be documented. Supports `eng_Latn → tha_Thai` and `eng_Latn → mal_Mlym`. Model size ~600 MB (4-bit quantised versions smaller). Fully offline and private once downloaded.
  - **Cloudflare Workers AI translation:** Available; free daily neuron budget. Lower quality for complex film dialogue.
  - **MyMemory/LibreTranslate:** Very small quotas; emergency fallback only.
  - **Forbidden:** Unofficial Google Translate scrapers.
- **Evidence:** Hugging Face model card (NLLB), Google AI Studio docs, CF Workers AI docs, accessed 2026-10-08.
- **Confidence:** high for license facts; medium for quality rankings (pending spike S4)
- **Impact on design:** Translation ladder as in §9.7.1 with Gemini BYOK at top, NLLB offline second, CF Workers AI third. NLLB license documented in LICENSES.md.

---

### RQ-21 — Subtitle style standards
- **Question:** CPS, CPL, line limits for EN/TH/ML?
- **Answer:** No official Thai or Malayalam streaming-platform style guide was found in public sources. Using widely cited defaults from Netflix/BBC/EBU standards for English, and conservative values for Thai/Malayalam:
  - English: 42 CPL, 17 CPS, 2 lines, min 1.0 s, max 7.0 s.
  - Thai: 35-40 visible grapheme clusters per line, 14 CPS (reading speed slower due to orthographic complexity), 2 lines.
  - Malayalam: 32-36 grapheme clusters per line (conjuncts are wide), 12-14 CPS, 2 lines, min 1.2 s.
  These will be written into docs/SUBTITLE-STYLE.md and confirmed with native speaker review.
- **Evidence:** EBU R37 subtitle guidelines; Netflix partner style guides (public excerpts); no Thai/ML primary source found.
- **Confidence:** medium (Thai/ML values are reasoned estimates; must be reviewed by native speakers)
- **Impact on design:** QA rules in §9.8 use these defaults. The Review Kit includes length/speed ratings.

---

### RQ-22 — Thai and Malayalam typography
- **Question:** Free fonts, shaping pitfalls, Intl.Segmenter for Thai?
- **Answer:**
  - **Fonts:** Noto Sans Thai, Noto Serif Thai, Noto Sans Malayalam, Noto Serif Malayalam — all **SIL OFL 1.1** (free, commercial use allowed). Manjari (Malayalam), Anek Malayalam, IBM Plex Sans Thai — also OFL. Available as subsetted woff2 via fontsource npm packages (MIT wrapper).
  - **Intl.Segmenter for Thai (word-boundary):** Supported in Chrome, Edge, Safari (2022+). Firefox support: introduced in Firefox 125 (2024). As of 2026-10, Firefox has it. **Confidence: medium** — verify in spike S6 against current Firefox ESR.
  - **Malayalam shaping pitfalls:** Chillu letters (U+0D7A–U+0D7F), virama (U+0D4D), ZWJ/ZWNJ sequences for conjuncts. Must normalise to NFC. Atomic chillu (prefer U+0D7A form over consonant+virama+ZWJ). Never split a conjunct. Test with known tricky strings.
  - **Thai shaping:** Tone marks stack above base consonants; line-height must be >= 1.5, preferably 1.6 for subtitle containers. Never use `overflow:hidden` with tight line-height.
- **Evidence:** font-spec.info (OFL), Unicode standard, fontsource.org, accessed 2026-10-08.
- **Confidence:** high (fonts/license); medium (Intl.Segmenter Firefox — verify in spike)

---

### RQ-23 — TMDB API
- **Question:** Free terms, attribution requirements, rate limits?
- **Answer:** TMDB API is free for non-commercial use. Required attribution: must display "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB." TMDB logo required. Cache TTL: up to 6 months allowed. Rate limits: not publicly specified precisely (community reports: ~40 req/s; be conservative and cache aggressively). Image CDN: `image.tmdb.org`. Language support includes `th-TH`, `ml-IN`, `en-US` for title and description queries.
- **Evidence:** themoviedb.org/terms, tmdb API docs, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** TMDB proxy in the Worker hides the API key; responses cached 24 h (details) and 7 days (posters). Attribution text and logo on About page.

---

## GROUP D — DIFFERENT NATIONS

### RQ-24 — Network and regulatory reality
- **Question:** VoIP/WebRTC restrictions in India, Gulf, Thailand?
- **Answer (informational; not circumvention guidance):**
  - **India:** No broad restriction on WebRTC/VoIP. Mobile data uses CGNAT widely; STUN reflexive candidates may not form; TURN relay is commonly needed.
  - **Gulf states (UAE, Saudi, Oman, Qatar, Kuwait, Bahrain):** UAE and Oman have historically blocked or throttled VoIP for consumer use (WhatsApp voice, etc.). This may affect WebRTC media paths. Together mode (text-only sync over WebSocket) is unaffected. Do NOT build circumvention; show a kind message and use relay-only as the fallback.
  - **Thailand:** Generally no WebRTC restrictions. Mobile CGNAT applies.
  - **EU/US:** No restrictions; standard TURN/STUN works.
- **Evidence:** Community reports and published journalism; low confidence for specific current status.
- **Confidence:** low (regulations change; this is for design guidance only)
- **Impact on design:** Together mode must work with WebSocket-only (no WebRTC at all). Voice/video unavailability message is kind and non-judgmental.
- **Owner action needed:** Follow local laws. If the partner is in a country with VoIP restrictions, Together mode still works; voice/video may not.

---

### RQ-25 — Latency realities
- **Question:** Typical RTT for India-Thailand, India-Gulf, India-EU/US?
- **Answer:** Approximate RTT via home internet (Cloudflare edge routing):
  - India ↔ Thailand: 80–150 ms
  - India ↔ Gulf: 60–120 ms
  - India ↔ EU: 130–200 ms
  - India ↔ US West: 200–280 ms
  - India ↔ US East: 250–350 ms
- **Evidence:** Cloudflare latency data, network operator benchmarks (community); accessed 2026-10-08.
- **Confidence:** medium
- **Impact on design:** Sync engine designed for up to 400 ms RTT. Scheduled start lead = clamp(1.5×RTT + 150, 300, 1500) ms. All test profiles in §16.5 are grounded in these numbers.

---

### RQ-26 — Time zones and scheduling
- **Question:** Intl.DateTimeFormat, .ics generation, Buddhist calendar?
- **Answer:** `Intl.DateTimeFormat` with `timeZone` parameter: all modern browsers. Buddhist calendar: `th-TH` defaults to Buddhist Era (e.g., year 2569 for 2026). Using `-u-ca-gregory` suffix forces Gregorian. `.ics` (RFC 5545): no dependency needed; ~80 lines of plain string generation. Google Calendar: `https://calendar.google.com/calendar/r/eventedit?...`. Apple/Outlook: open `.ics` file.
- **Evidence:** MDN, RFC 5545, Google Calendar URL docs, accessed 2026-10-08.
- **Confidence:** high
- **Impact on design:** Default to Gregorian calendar in all date displays; show Buddhist year in tooltip for TH locale. ICS generation is in-app, no dependency.

---

## GROUP E — SECURITY AND PRIVACY

### RQ-27 — WebRTC IP exposure
- **Question:** mDNS obfuscation, relay-only trade-offs?
- **Answer:** Chrome/Firefox obfuscate local IP candidates using mDNS (`.local` hostnames) by default. The server-reflexive (srflx) candidate from STUN reveals the public IP. With `iceTransportPolicy: 'relay'`, only TURN relay candidates are sent, hiding the public IP from the peer at the cost of higher latency and TURN bandwidth.
- **Confidence:** high
- **Impact on design:** "Hide my IP" setting switches to relay-only policy. Explained plainly. TURN usage estimate shown when enabled.

---

### RQ-28 — Browser E2EE primitives (WebCrypto)
- **Question:** AES-GCM, HKDF, ECDH — support?
- **Answer:** WebCrypto API with AES-GCM, HKDF, ECDH P-256, and HMAC-SHA256 is supported across all target browsers. X25519 support is available in Chrome and Firefox but not verified for older Safari — use P-256 for broader compatibility.
- **Confidence:** high
- **Impact on design:** Use P-256 for ephemeral ECDH. HKDF-SHA256 for key derivation. AES-GCM for encryption. No third-party crypto libraries — WebCrypto only.

---

### RQ-29 — CSP for WASM/ML/WebRTC apps
- **Question:** Required CSP directives, COOP/COEP trade-offs?
- **Answer:**
  - `wasm-unsafe-eval` required in `script-src` for WASM execution.
  - `worker-src blob: 'self'` required for inline workers and worklets.
  - COEP (`Cross-Origin-Embedder-Policy: require-corp`) + COOP (`Cross-Origin-Opener-Policy: same-origin`) are required to enable `SharedArrayBuffer`. However, they block cross-origin resources (TMDB images, model hosts) unless those resources set `Cross-Origin-Resource-Policy: cross-origin`. Since ffmpeg.wasm multi-thread requires `SharedArrayBuffer`, and multi-thread requires COEP/COOP, and COEP/COOP complicates model downloads from Hugging Face: **use single-threaded ffmpeg.wasm (no SharedArrayBuffer needed)**. Record this trade-off in ADR-0005.
  - `connect-src` must explicitly list model download hosts (huggingface.co CDN endpoints) and the TURN/STUN endpoints.
- **Confidence:** high
- **Impact on design:** Single-threaded ffmpeg.wasm. CSP in `_headers` / Worker response headers. No COEP/COOP required for our single-threaded approach.

---

### RQ-30 — Legal posture
- **Question:** Privacy policy basics for India/Thailand/GDPR?
- **Answer:** We collect essentially nothing. No accounts, no analytics, no tracking cookies. Data stays on the user's device. The Privacy & Use page must state: what we collect (nothing server-side), what stays local (film resume points, generated subtitles, model cache, room secret if "remembered"), what is E2EE, third parties (Cloudflare infrastructure; TMDB via proxy; optional model hosts on consent), and honest E2EE limits. India's DPDP Act 2023, Thailand's PDPA, and GDPR all apply; minimal data collection means minimal obligation, but a plain-language disclosure page is still required. Contact address for abuse/takedown should be the GitHub issues page.
- **Confidence:** medium (not legal advice)

---

## GROUP F — EXPERIENCE AND CRAFT

### RQ-31 — PWA on iOS and Android
- **Question:** Storage eviction, service worker caching of large models?
- **Answer:** iOS Safari may evict script-writable storage (IndexedDB, Cache Storage) after ~7 days of non-use for non-installed PWAs. Installed PWAs (Add to Home Screen) are substantially more resilient. For model files: store in Cache Storage, request `navigator.storage.persist()` after first download, show quota estimate. On eviction, detect missing model and offer re-download with a friendly message.
- **Confidence:** medium (eviction timeframe from community reports; not primary-source-verified)
- **Impact on design:** "Install for the best experience" prompt is important for subtitle generation users.

---

### RQ-32-36 — Accessibility, Performance, Cinematic UI, Device Tiers, License Hygiene
- **RQ-32 Accessibility:** WCAG 2.2 AA standard applies. Key gap for media: captions must be keyboard-accessible; custom controls must have ARIA roles.
- **RQ-33 Performance:** LCP target 2.5 s (4G mobile), INP 200 ms, CLS 0.05. Route-based code splitting in Vite achieves these for the landing/foyer. Theatre route includes the sync engine and subtitle renderer.
- **RQ-34 Cinematic UI refs:** Premium film festival sites (TIFF, Sundance digital), Mubi, Criterion Channel, Letterboxd — common elements: dark velvet surfaces, large typography, subtle grain, warm accent colours, minimal chrome. Matinee's "Midnight Matinee" system matches these principles.
- **RQ-35 Device tiers:** Use `navigator.deviceMemory` + `hardwareConcurrency` as tier signals. `prefers-reduced-motion` always respected regardless of tier.
- **RQ-36 OSS license hygiene:** Syncplay is Apache 2.0 (safe to learn from; no code copy needed). Watch-together OSS repos found on GitHub: most are GPL/AGPL (do not copy code). Learn patterns, write fresh code.

---

## PRE-CHECKED FACTS VERIFICATION (§7.1)

| # | Original claim | Verified status |
|---|----------------|----------------|
| F1 | CF Realtime TURN: 1,000 GB/month free, card required | **CONFIRMED** — card is required |
| F2 | DO available on free plan; SQLite-backed; daily limits; fail at limit | **CONFIRMED** — 100k req/day shared |
| F3 | WebSocket Hibernation API; in-memory lost on hibernation | **CONFIRMED** — use serializeAttachment |
| F4 | getDisplayMedia not on mobile; system audio varies by OS | **CONFIRMED** |
| F5 | OpenSubtitles free API limits inconsistent | **PARTIALLY CONFIRMED** — ~5/day anonymous; BYOK for more |
| F6 | CF Pages 25 MiB per file limit | **CONFIRMED** — 25 MiB exactly |
| F7 | NLLB-200 CC-BY-NC non-commercial | **CONFIRMED** |
| F8 | WebGPU broad desktop support; Safari recently added | **CONFIRMED** — Safari 26 (Sep 2025), broadly available |
