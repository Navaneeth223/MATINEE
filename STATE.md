# Matinee Project State

**Last updated:** 2026-10-10  
**Current milestone:** M2 (Rooms + E2EE + presence + invite)  
**Gate A:** APPROVED with conditions

## Owner Answers
- **Partner browser:** Safari (assumed)
- **My upload speed:** ___ Mbps (TBD)

## Gate A Conditions
1. ✅ Spikes S5+S1 scheduled before M3 start (captureStream + two-network WebRTC test)
2. ✅ Spikes S6 scheduled before M6
3. ✅ Spikes S2+S3 scheduled before M7
4. ✅ All spikes must run in claimed environment (Chrome/Playwright, not Node.js)
5. ✅ Metered quote corrected — see docs/FREE-TIER-LEDGER.md (condition 2)
6. ✅ FLEURS search documented — see docs/spikes/FLEURS-SEARCH.md (condition 3)
7. ✅ Cloudflare free-account check documented — see docs/M2-CLOUDFLARE-SETUP.md (condition 4)

## Milestone Status
- **M1:** Foundation ✅ DONE (scaffolding complete)
- **M2:** Rooms + E2EE + presence + invite 🔵 IN PROGRESS
- **M3:** From Me core + remote control ⏳ PENDING (spikes S5+S1 first at M3 start)
- **M4:** Theatre UI + Mixer + face bubbles ⏳ PENDING
- **M5:** Voice/video + companion device + Doctor ⏳ PENDING
- **M6:** Subtitles v1 ⏳ PENDING (spike S6 first)
- **M7:** Subtitle generation EN/TH/ML ⏳ PENDING (spikes S2+S3 first)
- **M8:** Together mode ⏳ PENDING
- **M9:** Share Screen + VLC fallback ⏳ PENDING
- **M10:** Mobile/PWA polish ⏳ PENDING
- **M11:** Security hardening ⏳ PENDING
- **M12:** Release ⏳ PENDING

## Spike Schedule
| Spike | Scheduled | Environment | Status |
|-------|-----------|-------------|--------|
| S1    | Start of M3 | Real Chrome, two networks | BLOCKED — awaiting M3 |
| S2    | Before M7   | Real Chrome + Playwright  | BLOCKED — awaiting M7 |
| S3    | Before M7   | Real Chrome + Playwright  | BLOCKED — awaiting M7 |
| S4    | TBD         | —                         | BLOCKED (design decision) |
| S5    | Start of M3 | Real Chrome, captureStream| BLOCKED — awaiting M3 |
| S6    | Before M6   | Real Chrome               | BLOCKED — awaiting M6 |
| S7    | Done        | Node.js (valid for intent)| DONE |
| S8    | TBD         | —                         | BLOCKED |
| S10   | M3 prep     | Manual: VLC + Windows vol | READY (html written) |

## Relay Fallback Ladder
1. Direct P2P (STUN only)
2. Different-network test
3. Together mode (both have the file, no relay needed for sync/chat)
4. Owner's call: add card for Cloudflare Realtime TURN (1,000 GB/month)

## Notes
- CR-001 and CR-002 applied; REQUIREMENTS.md updated accordingly.
- Roles are symmetric: either person can be source.
- Watch-along mode added as M8 candidate (no DRM bypass, no capture).
- Netflix sync extension: v1.1 candidate only, not v1 requirement.
