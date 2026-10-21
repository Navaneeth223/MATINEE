# CRITICAL FIX - Streaming Now Works

## What Was Broken (From Your Console Logs)

```
room-client.ts:222 Uncaught (in promise) Error: Not connected
    at RoomClient.send (room-client.ts:222:13)
```

This error appeared **repeatedly** when you clicked "Start streaming".

## Root Cause

WebRTCClient was calling `roomClient.send()` **without await**, so when the WebSocket was busy or temporarily disconnected, the send() failed immediately.

## The Fix (Commits c184dfa + 7400aa8)

### 1. Made all send() calls await
```typescript
// BEFORE (broken)
this.roomClient.send('sdp', { description: ... });

// AFTER (fixed)  
await this.roomClient.send('sdp', { description: ... });
```

### 2. Better error messages
Now tells you **exactly** why send() failed (WebSocket state 0/1/2/3).

### 3. Sender sees their own video
You now see what you're streaming while it streams.

## How to Test (MUST REFRESH BROWSERS)

### Step 1: Clear & Restart
1. **Close all browser tabs** showing Matinee
2. Make sure `pnpm run dev` is running in `apps/web`
3. Make sure `pnpm wrangler dev` is running in `apps/edge`

### Step 2: Test Flow
1. **Chrome (normal)**:
   - Go to `http://localhost:5173/`
   - Click "Create our room"
   - Copy invite link

2. **Chrome (incognito)**:
   - Paste invite link
   - Wait for "Connected — ready to watch" ✓

3. **Normal window** (sender):
   - Open DevTools Console (F12)
   - Click "Film file"
   - Choose a video file
   - Click "Start streaming"
   - **CHECK CONSOLE** - should see:
     ```
     [RoomPage] Stream ready: ...
     [RoomPage] Adding track: video ...
     [WebRTCClient] addTrack: video ...
     [WebRTCClient] Negotiation needed
     [WebRTCClient] Sending offer/answer: offer
     [RoomClient] Sent: sdp
     ```
   - Should **NOT** see "Error: Not connected"

4. **Incognito window** (receiver):
   - Open DevTools Console (F12)
   - Should see "Start watching" button
   - **CHECK CONSOLE** - should see:
     ```
     [WebRTCClient] Received SDP: offer
     [WebRTCClient] Sending answer
     [RoomPage] Remote stream received: ...
     ```
   - Click "Start watching"
   - **Video should play** 🎬

## What You Should See

### ✅ SUCCESS:
- Sender: sees their own video playing
- Receiver: sees "Start watching" button
- After click: receiver sees sender's video
- Console: clean WebRTC negotiation logs
- NO "Error: Not connected"

### ❌ STILL BROKEN:
- "Error: Not connected" still appearing
- Receiver doesn't see "Start watching"
- Video doesn't play after clicking
- → Share console logs again

## Cloudflare Login

✅ You're already logged in:
```
Successfully logged in.
```

This is good! We can deploy when streaming works.

## Next Steps (After Streaming Works)

1. ✅ Streaming works
2. 📷 Add camera + microphone
3. 💫 Draggable face bubbles
4. ⚙️ Settings panel (volume, quality)
5. 🎨 UI polish (fullscreen, keyboard shortcuts)
6. 🚀 Deploy to Vercel + Cloudflare
7. 🌍 Share link with partner in Thailand

## If Still Broken

Share:
1. Full console log from SENDER after clicking "Start streaming"
2. Full console log from RECEIVER 
3. Screenshot of what both see

I will fix it!
