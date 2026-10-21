## STATE (2026-10-10 17:30)

| Commit | Fixed | Test Again |
|--------|-------|------------|
| c184dfa | WebRTC send() await | YES - main fix |
| 7400aa8 | Sender sees own video | YES |

## Root Cause Found & Fixed
**Error: Not connected at room-client.ts:222**
- WebRTCClient was calling `roomClient.send('sdp', ...)` WITHOUT await
- All send() calls now properly awaited
- Added WebSocket state logging

## User Must Test Again
1. Refresh both browsers
2. Connect (should still work ✓)
3. Click "Film file" or "Share screen"  
4. Start streaming
5. **Check console** - should NOT see "Not connected" errors
6. Partner should see "Start watching" button
7. Click it - video should appear

## Next After Streaming Works
1. Camera + Mic support
2. Draggable face bubbles
3. Settings panel
4. Deploy to Vercel

## Context
157K/200K - critical fix done, awaiting user test
