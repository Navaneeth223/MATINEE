# Gate A Report

Date: 2025-01-10  Path: C (Together mode)  Status: PASSED

## Key Decisions
- [x] Path C selected: sync/chat/subtitles via WebSocket; no TURN for M1–M4
- [x] Voice/video (M5) deferred; relay provider to be verified card-free
- [x] Cloudflare Realtime TURN deferred (card required); Metered added to ledger
- [x] Whisper FLEURS WER for ML/TH not in paper; community benchmarks cited
- [x] Together mode confirmed: no TURN relay needed for sync, chat, or subtitles

## Requirements Status
- [x] REQUIREMENTS.md: O1–O11, FR-xxx (100s–800s), NFR-01–15, Acceptance Tests, Milestones M1–M5, Out of Scope
- [x] ASSUMPTIONS.md: A12 (Path C chosen), A13 (M5 relay deferred)

## Spikes Status
- [x] S1 BLOCKED: requires deployed Cloudflare DO (post-M1)
- [x] S2 DONE: audio extraction API availability verified; WebCodecs browser-only; ffmpeg.wasm viable fallback
- [x] S3 DONE: Whisper-tiny WASM ~3–5 min/10 min audio; WebGPU ~60–90 s; @huggingface/transformers confirmed
- [x] S4 BLOCKED: requires Gemini API key (BYOK at M3)
- [x] S5 DONE: WebSocket RTT measured/estimated; sync latency within NFR-02 target
- [x] S6 DONE: Intl.Segmenter('th', word) verified in Node 20; Thai segmentation correct
- [x] S7 DONE: Intl.Segmenter('ml', grapheme) verified; Malayalam conjuncts segment correctly
- [x] S8 BLOCKED: requires iOS device (cross-device QA at M2)

## Research Corrections
- [x] RQ-18: ML/TH FLEURS WER not in Whisper paper; community benchmarks cited
- [x] RQ-24: Together mode = WebSocket only, no TURN; voice relay estimate added (28 MB/2-hr call)
- [x] RQ-02: Cloudflare TURN requires card; deferred to M5; Metered added as alternative

## §7.9 Checklist
- [x] Path decision recorded (Path C, no TURN M1–M4)
- [x] REQUIREMENTS.md written with FR/NFR/acceptance tests/milestones
- [x] ASSUMPTIONS.md updated (A12, A13)
- [x] Spike S2 (audio): DONE
- [x] Spike S3 (Whisper): DONE
- [x] Spike S5 (WebSocket latency): DONE
- [x] Spike S6 (Thai segmenter): DONE
- [x] Spike S7 (Malayalam rendering): DONE
- [x] Spikes S1, S4, S8: BLOCKED with documented reasons
- [x] RESEARCH.md corrected (RQ-02, RQ-18, RQ-24)
- [x] FREE-TIER-LEDGER.md updated (Metered row; Cloudflare TURN deferred)
- [x] Out-of-scope list in REQUIREMENTS.md
- [x] No card required for M1–M4 (NFR-14)

## Gate Status

GATE A: PASSED — all prerequisites met for M1 implementation start.
