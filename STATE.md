# Matinee State

## M2: E2EE Rooms (DONE)
- Manual test PASSED

## SLICE 1: WebRTC Feasibility (DONE)
- Loopback test: pcA -> pcB in same page, video + audio stream
- Results: video 320x240, 80 frames decoded, currentTime advancing, audio level 10.5
- **Volume independence CONFIRMED**: host local gain=0 does NOT affect received audio
- Report: docs/spikes/S5.md

## Next
- SLICE 2: "From Me" core (file picker, perfect negotiation, remote control)
