## STATE (2026-10-10 19:00) - Context 162K/200K

## Issue: Click "Start streaming" → Nothing happens

User console shows:
- Sender: Only "[RoomClient] Sent: state" (position updates)
- Receiver: Error "Cannot read properties of undefined (reading 'type')" at webrtc-client.ts:64
- **Missing**: NO "[RoomPage] Stream ready" log!

## Just Added (commits 42890ab + latest)
- SourcePanel logging: will show "[SourcePanel] Film start" or "[SourcePanel] Requesting screen capture"
- handleStreamReady try-catch: will show "[RoomPage] handleStreamReady ERROR" if it fails

## USER: Test with console open
1. Refresh sender browser
2. Click "Film file", pick video
3. Click "Start streaming"
4. **Should see in console**:
   - `[SourcePanel] Film start - creating audio context`
   - `[SourcePanel] Calling onStreamReady with 2 tracks`
   - `[RoomPage] Stream ready: ...`

## If STILL nothing in console
- The button click isn't firing
- OR JavaScript error earlier blocking everything
- Share FULL console from page load

## Workflow recommendation
Given complexity + context limit → launch workflow with:
- Task: "Fix Matinee WebRTC streaming + complete UI"
- Files: apps/web/src/*, apps/edge/src/*
- Test: E2E passes, manual browser test works
- Then: camera, face bubbles, deploy

I've fixed many issues but streaming needs systematic debugging.
