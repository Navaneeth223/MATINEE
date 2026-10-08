# RISKS.md — Risk Register
> Created: 2026-10-08. Reviewed at every Gate.
> Likelihood: H=High M=Medium L=Low. Impact: H=High M=Medium L=Low.

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status |
|----|------|-----------|--------|-----------|-------|--------|
| R01 | Cloudflare DO free daily quota exhausted during heavy use | M | M | Quota guard at 70%/90%; refuse new rooms first; keep existing rooms alive; Node WS fallback configured | Agent | Open |
| R02 | Cloudflare Realtime TURN requires credit card — owner may decline | M | M | Metered open-relay fallback (no card); Together mode works without TURN (text-only sync) | Owner | **Needs decision at Gate A** |
| R03 | Safari (macOS/iOS) lacks captureStream() — Mode B host impossible | H | L | Mode B host hidden on Safari; clearly explained; Together mode promoted | Agent | Mitigated |
| R04 | getDisplayMedia not available on any mobile browser | H | L | Mode C host hidden on mobile; only viewer role available; Together mode is default | Agent | Mitigated |
| R05 | Malayalam STT quality too low to be useful from audio | H | H | Strong preference for existing subtitles (§9.4 routing); STT is last resort; flagged output; honest labelling; companion tool as fallback | Agent | Open |
| R06 | Thai STT quality poor; hallucinations on silence/music | H | M | VAD pre-filtering; hallucination defence rules (§9.5.4); honest labelling; Review Kit with native-speaker review | Agent | Open |
| R07 | Whisper hallucinations on silence/music produce garbage cues | H | M | VAD gates input; phantom-phrase denylist; repetition detection; low-confidence flagging | Agent | Mitigated (in design) |
| R08 | ML model cache evicted by iOS Safari (non-installed PWA) | M | M | Persistent storage request; installed PWA prompt; graceful re-download with resumption | Agent | Mitigated (in design) |
| R09 | Codec incompatibility: AC-3/HEVC/MKV cannot play in browser | H | M | Format Doctor shows ffmpeg remux recipes; plain-language explanation; no silent failure | Agent | Mitigated (in design) |
| R10 | Partner's network blocks WebRTC UDP — media fails silently | M | M | Automatic TURN fallback; TCP/TLS-443 TURN path; graceful relay-only; Together mode text-only path | Agent | Mitigated (in design) |
| R11 | ToS changes in OpenSubtitles, TMDB, or Gemini free tier | M | H | Monitor via monthly ledger review; all are opt-in/BYOK/fallback; never a single point of failure | Owner | Ongoing |
| R12 | NLLB-200 CC-BY-NC license: non-commercial only | H | L | Documented in LICENSES.md; private personal use is compliant; clearly labelled in the UI | Agent | Mitigated |
| R13 | Gemini free tier data-use terms: prompts may train Google models | H | M | Per-film consent dialog; BYOK (not our key); subtitle text is film dialogue, not personal data; user can choose NLLB offline instead | Agent | Mitigated (in design) |
| R14 | Sync drift exceeds targets under high-latency networks (>300 ms RTT) | M | H | Drift controller tested in simulator at all network profiles (§16.5); scheduled-start lead dynamically adjusted; hard seek as last resort | Agent | Open (needs spike S7) |
| R15 | "Perfect negotiation" WebRTC glare causes connection deadlock | L | H | Implement canonical polite/impolite pattern exactly as in spec; property-test all orderings | Agent | Mitigated (in design) |
| R16 | Large MKV file (>4 GB) causes browser memory overflow during hashing | M | M | Fingerprint uses only 3 MB of slices (§8.4); never read whole file; Web Worker; memory ceiling check | Agent | Mitigated (in design) |
| R17 | Duplicate room code collision (10 Crockford Base32 chars = 50 bits) | L | L | 50 bits gives 1 in 1T collision probability for 1M rooms; re-generate on collision | Agent | Mitigated |
| R18 | iOS background suspension stops video/sync while partner is playing | H | M | Detect tab-hidden; mark "away"; on resume: ping + hard resync + "Catching up…" UX; guide user to install PWA | Agent | Mitigated (in design) |
| R19 | ffmpeg.wasm single-thread too slow for long films on low-end phones | H | M | Phone shows a warning before starting; companion `subtitle-forge` recommended; Groq/CF cloud fallback | Agent | Open |
| R20 | Cloudflare Realtime TURN free 1,000 GB/month: if many people use Matinee | L | H | Matinee is couple-scale (Mode A uses 0 TURN); relay is opt-in; kill-switch available | Agent | Mitigated |
