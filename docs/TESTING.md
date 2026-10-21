# Testing Guide

## Current Status (2026-10-10)
- ✅ D0: Both users connect successfully
- ⚠️ D1: Streaming logic fixed, needs verification
- ⚠️ Chat: Code correct, needs verification

## How to Test Locally

### 1. Start Dev Servers
```powershell
# Terminal 1 - Edge worker
cd apps/edge
pnpm wrangler dev --test-scheduled

# Terminal 2 - Web app
cd apps/web
pnpm run dev
```

### 2. Test Connection (2 browsers)
1. **Chrome** (normal): Go to `http://localhost:5173/`
2. Click "Create our room"
3. Copy the invite link
4. **Chrome** (incognito): Paste invite link
5. Both should show "Connected — ready to watch"

### 3. Test Streaming
1. **Browser A**: Click "Film file" or "Share screen"
2. **Browser A**: Select source and click "Start streaming"  
3. **Browser B**: Should see "Start watching" button
4. **Browser B**: Click "Start watching"
5. Video should play on B

### 4. Test Chat
1. Type message in either browser
2. Press Enter or click Send
3. Message should appear on both sides

## Debug Console Logs

Open browser DevTools (F12) and look for:

### WebRTC Logs
```
[WebRTCClient] addTrack: video ... 
[WebRTCClient] Negotiation needed
[WebRTCClient] Sending offer/answer: offer
[WebRTCClient] Received SDP: answer
[RoomPage] Remote stream received: ...
```

### Chat Logs
```
[useRoom] Sending chat: hello
[useRoom] Chat received: { text: 'hello' }
```

### Common Issues

**"Your network needs a relay"**
- Should ONLY show after 15s of streaming
- If immediate: bug (was fixed in 84e7ef2)

**Both see "Choose source"**
- Fixed in 84e7ef2
- One person should see source selector
- Other should see "Ready" then "Start watching"

**Video not reaching partner**
- Check console for WebRTC logs
- Look for "Negotiation needed" and "SDP" messages
- Check if tracks are added

**Chat empty**
- Check console for "[useRoom] Chat received"
- Verify payload has .text field
- Check Session.open() didn't fail

## Next Steps
1. Verify fixes work
2. Add camera/mic support
3. Face bubbles (draggable/resizable)
4. Fullscreen improvements
5. Deploy to Vercel + Cloudflare
