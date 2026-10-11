# FREE-TIER-LEDGER.md
> Last updated: 2026-10-08. Re-verify limits before each release.
> Source URLs are in RESEARCH.md. Every row must stay accurate to avoid surprise bills.

| Service | Purpose | Free Limit | How We Stay Under | At-Limit Behaviour | Fallback | Card Required? |
|---------|---------|------------|-------------------|-------------------|---------|---------------|
| **Cloudflare Workers** | API routes, asset serving | 100,000 req/day (shared with DOs) | Cache TMDB 24h; static assets served via asset binding (no request cost); quota guard at 70k/90k | Error 1027; new room creation blocked; existing rooms continue | Node WS fallback on Render | No |
| **Cloudflare Durable Objects** | Room coordinator, WebSocket relay | 100,000 req/day (shared); 13,000 GB-s compute/day; 5 GB storage | Hibernation API (no idle duration billing); only 2 peers per room; minimal DO storage (room meta only). **Together mode (sync, chat, subtitles) uses WebSocket only — no relay, no TURN. This is the primary data path for M1–M4 and has no relay cost.** | New rooms blocked; existing rooms continue; "tonight's capacity" message shown | Node WS fallback | No |
| **Cloudflare Realtime TURN** | NAT relay for WebRTC media | 1,000 participant-minutes/month | Mode A (sync) uses zero TURN; relay only when Hide-my-IP is on or direct fails; usage shown in Foyer; kill-switch FEATURE_RELAY=off | Relay disabled gracefully; direct WebRTC or relay-less sync still works | Metered open-relay (no card) | **YES** — **DEFERRED TO M5** — not used in M1–M4. Card required to activate service (free tier of 1,000 participant-minutes/month; card still required for billing account activation). Re-evaluate at M5 alongside Metered. |
| **STUN (Cloudflare + Google)** | NAT discovery | Unlimited (by convention) | Not metered; use two providers for redundancy | STUN failure → TURN relay; Together mode unaffected | Third public STUN server | No |
| **Cloudflare Turnstile** | Bot protection on room creation | Unlimited requests, 20 widgets | 1 widget for Matinee production; 1 for staging | No hard limit on requests; widget limit not a concern at our scale | Disable flag: FEATURE_TURNSTILE=off | No |
| **Cloudflare Pages (if used)** | Static asset hosting | 25 MiB/file; 20,000 files; 500 builds/month | JS bundles gzipped <300 KB; no models/WASM in the bundle; lazy-load from external hosts | Build failure if bundle exceeds limit | Same Worker serves assets via Assets binding (preferred) | No |
| **TMDB API** | Film metadata, posters | Non-commercial free; ~40 req/s (community estimate) | Proxy in Worker; cache details 24h, posters 7d; deduplicate in-flight requests | Show cached data; show "metadata unavailable" | OMDb free tier (1,000 req/day) | No (free account) |
| **OpenSubtitles REST API** | Community subtitle download | ~5 downloads/day anonymous; higher with user account BYOK | Opt-in only; cache by file fingerprint (never fetch twice); show quota remaining; graceful "quota used" message | Fall through to next subtitle-finding method | SubDL; sidecar file; generate from audio | No (free account for BYOK) |
| **Gemini API free tier** | LLM translation (BYOK) | RPM/RPD model-specific; check AI Studio dashboard | Batch 40-60 cues per request; backoff with jitter on 429; per-day client-side counter; pause with ETA | "Translation paused — free limit reached. Resumes at midnight." | Next engine in ladder (NLLB, CF Workers AI) | No (Google account) |
| **Cloudflare Workers AI (Whisper)** | Optional cloud STT accelerator | 10,000 neurons/day; 2 MB audio per request | Opt-in; BYOK; chunk audio <2 MB; daily counter shown in Studio | "Cloud transcription paused for today." | In-browser Whisper (always available) | No |
| **Hugging Face (model host)** | Whisper/NLLB model downloads | Bandwidth; no stated hard cap for inference models | Pin exact revisions; download once; Cache Storage + Range resume; do not re-download on each session | "Model download failed — retry?" with partial-file resume | In-browser tiny model or companion tool | No |
| **GitHub Actions** | CI/CD | 2,000 min/month (private repo); unlimited (public repo) | Keep public if no secrets in repo history; use caching for node_modules; fast unit tests first | CI pipeline slows; some checks deferred to nightly | Self-hosted runner (owner's machine) | No |
| **NLLB-200 (local)** | Offline translation | No limit (local model) | License: CC-BY-NC (private personal use only; documented). No API calls. | N/A | LLM via Gemini | No |
| **Metered TURN (Open Relay)** | TURN relay fallback (M5 voice/video) | 20 GB/month | Voice-only default (32 kbps Opus ≈ 28 MB per 2-hr call); relay usage meter in UI; kill-switch to disable relay | Graceful degradation: "Relay unavailable"; fall back to direct WebRTC if ICE succeeds | Together mode (no voice/video) — M1–M4 unaffected | **Verify at M5** — signup flow TBD; check if card-free |

---

## Stop-the-Line Disclosures

1. **Cloudflare Realtime TURN requires a credit card** even for the free tier. This is disclosed at setup time. The owner must explicitly add a payment method before the TURN credential endpoint will work. Free tier covers 1,000 GB/month which is ample for personal use. If the owner declines, we fall back to Metered open-relay.

2. **Gemini free tier data-use terms:** Prompts on the free tier may be used by Google to improve products. Subtitle text (film dialogue) sent for translation is disclosed in a per-film consent dialog. Do not use the free tier for sensitive personal communications.
