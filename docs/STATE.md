## STATE (2026-10-10 16:45)

| Phase | Status | Next |
|-------|--------|------|
| D0 | ✓ | StrictMode bug fixed |
| D1 | testing | Fixed sender/receiver logic, ICE timing - USER TESTING NOW |

## Just Fixed (commit 84e7ef2)
- canStartStreaming: only first peer (not streaming, no remote)
- isViewer: only receiver (has remote, not sending)  
- ICE timeout: moved to handleStreamReady (only when streaming)
- Both sides showing "Choose source" → FIXED

## User Testing Results
- ✅ Both connected (D0 working)
- ❌ Video not reaching partner (WebRTC negotiation issue?)
- ❌ Chat messages not visible (payload empty?)
- ⚠️ "Relay needed" showing immediately → FIXED in 84e7ef2

## TODO Next
1. Test locally: reproduce video + chat issues
2. Add console logs for WebRTC + chat debugging
3. Camera/mic support
4. Face bubbles (draggable)
5. Fullscreen improvements

## Context
149K/200K - continue debugging streaming
