# Gate A Report

**Date:** 2026-10-10  
**Status:** READY FOR REVIEW (owner decides)

## Key Decisions
- Mode B (From Me) primary at M3; symmetric roles (FR-210)
- WebRTC+STUN for M1-M2; no relay; TURN decision at M3 start after two-network test
- E2EE at M2 before messaging
- Watch-along mode (FR-950-955) added; Netflix extension logged as v1.1 (not v1)

## Requirements (CR-001 + CR-002 Applied)
✅ REQUIREMENTS.md: Milestones M1 Foundation (done) → M2 Rooms+E2EE → M3 From Me → M4 Theatre UI → M5 Voice → M6 Subtitles → M7 Gen → M8 Together → M9 Share → M10 Mobile → M11 Security → M12 Release
✅ ASSUMPTIONS.md: A12 WebSocket-only struck; WebRTC+STUN clarified
✅ Out-of-scope: Netflix extension v1, lossless video, >2 peers, accounts

## Spikes
✅ S7 VALID (Malayalam rendering works)
⚠️ S2/S3/S5/S6 INVALID (Node.js tests; browser retest required)
⏸️ S1/S4/S8 BLOCKED (reasons documented)
📝 S10 CREATED (docs/spikes/s10.html — Windows volume test)

## Research Corrections
✅ Metered (RQ-04): 500 MB free trial, no card. Quote: "No credit card required" (metered.ca/pricing, 2026-10-10). ~18 hrs voice relay.
✅ Whisper FLEURS (RQ-18): Malayalam/Thai WER not in paper appendix; use large-v2 at M7.
✅ WebRTC (RQ-24): Mode B uses WebRTC for media, WebSocket for signaling only.

## Owner Answers Pending
- Partner browser: ___ (Safari or Chrome)
- My upload speed: ___ Mbps

## Next
Owner reviews and approves/rejects Gate A.
