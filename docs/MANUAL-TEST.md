# Manual Test Protocol

## Two windows on one PC
1. Open http://localhost:5199 → "Create our room" → window A shows room code
2. Click "Copy invite" in window A → verify address bar is clean (no #k=...), paste link in notes → count secret chars (must be exactly 22)
3. Paste invite link in window B, press Enter → both show green dots "You" + "Partner"
4. Chat: type in A "hello" Enter → B sees "Partner: hello"; type in B "hi" Enter → A sees "Partner: hi"
5. Window A: pick an MP4 file → video preview appears with local volume slider → click "Start streaming"
6. Window B: "Start watching" button appears → click it → video plays
7. Window B: click "Pause" → A's video pauses within 1 second; click "Play" → A resumes
8. Window B: drag volume slider → your audio changes; window A: drag local volume → only A's speakers change (B unaffected)
9. Reload window B (F5) → reconnects to "Connected", green dots return, chat history preserved in view
10. Success: both users can stream, control, and chat; secrets are 22 chars; address bar clean after connect; reload works

## Second device (phone/tablet)
Repeat steps 2-8 with window B on a different device on the same network. Confirm video plays, controls work, volumes independent.
