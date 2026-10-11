# Change Request CR-001 Summary

**Date:** 2026-10-10  
**Status:** Applied before Gate A  
**Classification:** Major changes (§19.6)

## Owner Answers Provided

- **Owner device:** Windows laptop + PC (Chrome/Edge); plays films in VLC
- **Partner device:** MacBook; browser = Safari or Chrome
- **Upload speed:** Unknown (to be measured by Doctor)
- **Partner film access:** Probably does NOT have the film file

## Key Changes

### 1. Mode B (From Me) is Now Primary Mode
- **Was:** Together mode (both have file) as default
- **Now:** Mode B (owner streams to partner) is MUST-have, moved to **M3**
- **Reason:** Partner likely doesn't have film file
- **Impact:** Core product flow changed; WebRTC video streaming becomes primary feature

### 2. Remote Control Added
- Partner can play/pause/seek/scrub in Mode B
- ±10s skip buttons
- Commands sent via WebSocket, executed by owner's player
- **Mode C limitation:** In Screen Share (VLC), remote control NOT available - UI must state this explicitly

### 3. Audio Mixer (Always One Tap Away)
- **Movie volume:** 0-100% + Boost to 300% with soft limiter
- **Partner voice volume:** Independent slider
- **My mic gain:** Separate control
- **Mute buttons:** Movie, partner, self
- **Independence:** Web Audio API separate branches (§8.8) - my volume changes don't affect what partner hears
- **Persistence:** Settings remembered per device

### 4. Voice Clarity Features
- Mic/speaker picker dropdowns
- Echo cancellation toggle
- Noise suppression toggle
- Level meter (VU meter)
- Test tone
- Opus mono 32-48 kbps
- Optional "Voice clarity" EQ
- Keep audio ducking (§8.10)

### 5. Face Bubbles
- **Draggable AND resizable** (handles + S/M/L preset buttons)
- **Shapes:** Circle or square toggle
- **Snap to corners:** Auto-snap when dragged near edge
- **Lock position:** Prevent accidental dragging
- **Opacity:** 20%-100% slider
- **Hide:** Remove overlay (audio continues)
- **Fullscreen:** Stay visible and functional
- **Smart positioning:** Never cover subtitles (auto-reposition if needed)

### 6. Companion Device
- **Use case:** Owner's laptop joins as camera+mic while PC sends movie
- **Join method:** QR code or 6-digit code
- **Priority:** Should-priority
- **Implementation:** Simple version first

### 7. "Cinema+" Quality Preset
- **Maintain source resolution** (or near-source)
- **Bitrate cap:** ~70% of measured upload speed
- **Playout delay:** 1.5-3s for stability
- **Codec:** H.264 when Safari viewer detected
- **Doctor:** Measures upload and recommends preset
- **Honest messaging:** "near-source, not lossless" in UI and docs

### 8. MacBook Support
- **Browser:** Web only (Safari or Chrome)
- **PWA:** "Add to Dock" for persistence
- **No paid accounts**
- **Testing:** Add MacBook Safari to real-device checklist

### 9. VLC Fallback (Mode C)
- **Format Doctor offers Mode C with tips:**
  - Enable Focus Assist / Do Not Disturb
  - Share entire screen to get audio
  - Remote control not available
- **Spike required:** Test if lowering Windows volume lowers audio partner hears in Mode C

### 10. Spike S10 Added
- **Test:** Does lowering owner's Windows volume lower the audio partner hears in Mode C (getDisplayMedia)?
- **Save results:** `docs/spikes/S10-mode-c-volume-passthrough.md`

## Milestone Plan Revised

| Milestone | Old Plan | New Plan (CR-001) |
|-----------|----------|-------------------|
| M1 | Room + basic sync | Room + WebSocket (unchanged) |
| M2 | Subtitle generation | Subtitle generation (unchanged) |
| M3 | Translation + i18n | **Mode B (From Me) + Translation + Remote Control + Movie Volume + i18n** |
| M4 | E2EE + persistence | E2EE + Companion Device + Mode C fallback |
| M5 | Voice/video | Full Audio Mixer + Voice Clarity + Face Bubbles + Voice/Video |
| After M5 | N/A | **Together mode (deferred)** |

## Updated Functional Requirements

### New FR Series Added:
- **FR-200s:** Mode B (From Me) - 9 requirements
- **FR-250s:** Mode C (Screen Share Fallback) - 4 requirements
- **FR-300s:** Audio Mixer - 8 requirements
- **FR-350s:** Voice Clarity - 7 requirements
- **FR-400s:** Face Bubbles - 9 requirements
- **FR-900s:** Together Mode (Deferred) - 4 requirements

### Modified Assumptions:
- **A01:** Owner = Windows laptop/PC + VLC
- **A02:** Partner = MacBook (Safari/Chrome), no local film
- **A03:** Upload speed TBD (measured by Doctor)
- **A04:** Mode B is primary (not Together mode)
- **A12:** Rewritten to reflect Mode B primary
- **A14:** Added for MacBook web-only support

## Files Updated

1. ✅ `docs/ASSUMPTIONS.md` - A01-A04, A12, A14 updated
2. ✅ `docs/REQUIREMENTS.md` - Complete rewrite (v0.2)
3. ⏳ `docs/spikes/` - S10 to be added
4. ⏳ `docs/RESEARCH.md` - Corrections pending
5. ⏳ `docs/FREE-TIER-LEDGER.md` - Updates pending
6. ⏳ `docs/GATE-A-REPORT.md` - To be created after workflow completes

## Impact on Gate A

- **Classification:** Major changes, but applied BEFORE Gate A
- **Gate status:** Can still pass if all prerequisites met
- **Risk:** Increased complexity at M3 (Mode B + translation in same milestone)
- **Mitigation:** M3 is further out; clear functional decomposition in REQUIREMENTS.md

---

*CR-001 applied 2026-10-10 before Gate A approval*
