# Gate A Report — Matinee

**Date:** 2026-10-10  
**Status:** READY FOR REVIEW — owner decides pass/fail

---

## Key Decisions

- **Mode B (From Me)** is primary mode (M3); symmetric roles (FR-210)
- **WebRTC + STUN** for M1-M2; no relay; TURN decision at M3 start
- **E2EE at M2** before any messaging
- **Watch-along mode** added (FR-950-955) targeting M8/M9
- **Netflix extension** logged as v1.1 candidate; not v1 requirement

---

## Requirements

- **REQUIREMENTS.md** updated with CR-001 and CR-002
- **Milestones:** M1 (Foundation, done) → M2 (Rooms+E2EE) → M3 (From Me+Remote Control) → M4 (Theatre UI+Mixer+Face Bubbles) → M5 (Voice/Video+Companion+Doctor) → M6 (Subtitles v1) → M7 (Subtitle Gen EN/TH/ML) → M8 (Together Mode) → M9 (Share Screen+VLC) → M10 (Mobile/PWA) → M11 (Security) → M12 (Release)

---

## Spikes

| Spike | Status | Notes |
|-------|--------|-------|
| S1 | BLOCKED | Reason documented |
| S2 | INVALID | Node.js test; browser test required |
| S3 | INVALID | Node.js test; browser test required (Playwright acceptable) |
| S4 | BLOCKED | Reason documented |
| S5 | INVALID | Wrong test — should be captureStream to second browser, not WebSocket RTT |
| S6 | INVALID | Node.js test; browser test required |
| S7 | VALID | Results accepted |
| S8 | BLOCKED | Reason documented |
| S10 | CREATED | docs/spikes/s10.html — Windows volume passthrough test |

---

## Research Corrections

- **Metered TURN (RQ-04):** 500 MB free trial (corrected from 20 GB). No card required. Quote: "FREE TRIAL: Free: 500 MB trial - No credit card required" (metered.ca, accessed 2026-10-10). Sufficient for ~18 hours voice-only relay at 32 kbps Opus.
- **Whisper FLEURS WER (RQ-18):** Malayalam and Thai WER not found in paper appendix. Use large-v2 for M7; validate empirically.
- **WebRTC clarified (RQ-24):** Mode B uses WebRTC for media, WebSocket for signaling only. Previous "WebSocket-only M1-M4" assumption struck from ASSUMPTIONS.md A12.

---

## Owner Answers Pending

- **Partner browser:** ___ (Safari or Chrome)
- **My upload speed:** ___ Mbps

---

## Next

Owner reviews and approves or rejects Gate A.
