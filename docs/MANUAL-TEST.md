# Manual Test Protocol

## Two windows on one PC
1. Open http://localhost:5199 → "Create our room" → window A shows room code, green "You" dot
2. Click "Copy invite" in window A → paste in notes → secret must be exactly 22 chars; address bar must be clean (no #k=...)
3. Paste invite link in window B address bar, press Enter → both show green "You" + "Partner" dots, status "Connected — ready to watch"
4. Chat: type "hello" in A, Enter → B shows "Partner: hello"; type "hi" in B, Enter → A shows "Partner: hi"
5. Window A: click file picker, select MP4 → local video preview + volume slider appear → click "Start streaming"
6. Window B: "Start watching" button appears → click → video plays
7. Window B: click "Pause" → A's video pauses <1s; click "Play" → A resumes; click "-10s" → A jumps back
8. Window B: drag volume slider → only B's audio changes; Window A: drag local volume → only A's speakers change (B unaffected)
9. Reload window B (F5) → reconnects, green dots return, chat messages visible, video resumes if was streaming
10. Success criteria: both can stream, controls work, volumes independent, secrets 22 chars, address bar clean after join, reload works

## Second device (phone/tablet)
Repeat steps 2-8 with window B on a different device (same network). Video plays, controls respond, volumes stay independent.
