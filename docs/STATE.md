## STATE (2026-10-10 18:00)

| Commit | Fix | Status |
|--------|-----|--------|
| 854f5c0 | Manual createOffer() | ✓ E2E pass |

## Root Cause #2 Found
**onnegotiationneeded NOT firing** - WebRTC timing bug
- Added `createOffer()` method to WebRTCClient
- Call it manually after adding all tracks
- Logs now show: "Manually creating offer"

## USER: Test Again Now!
1. Refresh BOTH browsers completely
2. Connect (both should say "Connected")
3. Click "Film file", choose video, "Start streaming"
4. Console should show:
   ```
   [RoomPage] Triggering manual negotiation...
   [WebRTCClient] Manually creating offer...
   [WebRTCClient] Sending offer: offer
   [RoomClient] Sent: sdp
   ```
5. Partner should see "Start watching"
6. Click → video plays

## If STILL broken
- Share BOTH console logs
- But E2E test PASSES now!

## Context
160K/200K
