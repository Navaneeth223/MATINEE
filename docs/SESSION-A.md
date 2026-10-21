SESSION A. Save this brief to docs/SESSION-A.md first (verbatim). The owner has few credits:

no Playwright, no browser automation, no workflows. Verify only with `pnpm exec tsc --noEmit` (apps/web,

apps/edge), `pnpm exec vite build` (apps/web) and `vitest run` in packages/protocol. The owner tests by

hand. Write whole files in one Write; do not chain small Replace edits; never re-read a file you just

wrote; do not touch apps/edge unless tsc fails. Reports: max 5 lines. If your context is nearly full:

commit, STATE.md (15 lines), stop.

EVIDENCE FROM THE OWNER'S SCREENSHOTS (real bugs, fix them):

a) /r/<id> page sat on "Reading secret..." with Create/Join/Copy buttons. The Create/Join buttons were a

   mistake: the server already makes the first socket the creator. REMOVE them. The page connects by itself.

b) Chat shows "Peer: undefined": the UI reads the wrong field. Messages arrive and decrypt fine. Show payload.text.

   Also light-grey text on a white box is unreadable.

c) The Copy button produced a 43-char secret (32 bytes); the room's secret is 22 chars (16 bytes). That link

   would be refused. The invite must be built from the SAME in-memory secret the room is using.

d) The creator's address bar still showed #k=... after connecting. Strip it for every user.

e) Delete apps/web/test/pw-05..08 specs (they depend on the removed buttons). Keep the others as is.

STEP 1: room flow + chat + look (one rewrite; split into small files)

- lib/useRoom.ts: reads the secret ONCE (useState initializer -> readAndStripSecret: sessionStorage per

  roomId, history.replaceState to strip the hash for all users). No secret anywhere -> state 'incomplete'

  ("This link is incomplete, ask your partner to send it again"). Stable peerId per tab and room

  (sessionStorage). Connect in useEffect with cleanup that closes the socket and ignores events from stale

  sockets (React StrictMode runs effects twice). States: reading | connecting | alone | together |

  error:wrong-secret | error:full | error:closed.

- packages/protocol: buildInviteLink(origin, roomId, secret) + parseInviteFragment, with a vitest unit test:

  16 bytes -> 22 chars, round-trip equals, wrong length rejected. Paste the vitest summary.

- Copy button uses buildInviteLink; after copy show "Copied".

- Chat panel: dark theme, readable, "You"/"Partner", Enter sends, auto-scroll, text only.

- Look (Tailwind, no new deps, system-ui font): background #08070B, cards #15121B, accent #E7C98E (buttons,

  focus ring), text #FBF6EC, secondary #B7AEC0, rose #E07A8F for presence/errors, radius 14 px.

  Layout >=1024 px: stage (16:9, flex-1) on the left, chat column 340 px on the right; mobile: stage on top,

  chat below. Top bar: "Matinee", room-code chip, presence dots "You" / "Partner" (green when connected),

  Copy invite button. Calm plain-language status line for every state above.

- Foyer page: same style; one button "Create our room".

Commit "A1".

STEP 2: stream a film (no automation, build + tsc only)

- Source panel: <input type=file>; local <video> preview with the source's own controls (play/pause/seek) and a

  local volume slider. Format Doctor: after load, play 2 s muted=false in the page; if

  video.webkitAudioDecodedByteCount stays 0 or canPlayType is empty, show a clear card: "No sound: this file's

  audio (probably Dolby/AC-3) can't play in the browser" with this copyable command:

  ffmpeg -i "film.mkv" -map 0:v:0 -map 0:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart "film-web.mp4"

- "Start streaming" (enabled when state = together): webrtc-client.ts (already unit-tested in Chromium) + video

  captureStream() track + WebAudio branch (MediaElementSource -> localGain -> speakers; -> MediaStreamDestination

  -> peer connection) so the source's volume never changes what the viewer hears.

- Viewer: remote <video> muted behind a large "Start watching" button (user gesture; Safari needs it), then

  unmute. Viewer controls: play/pause, -10 s, +10 s, scrubber, fullscreen, volume 0-100% plus Boost up to 300%

  (GainNode + DynamicsCompressor limiter on the remote audio), mute. Volume settings saved per device in

  localStorage. Controls send sealed 'cmd' (pause/play/seek); the source applies them and replies sealed 'state'

  {paused,time}; both UIs update.

- Viewer stats line from getStats every 2 s: resolution, kbps, dropped frames, "direct" or "relay".

- ICE: stun.cloudflare.com:3478 and stun.l.google.com:19302; if not connected after 15 s show

  "Your network needs a relay (not set up yet)".

- Source can be either person; if the other person already streams, hide the source panel.

Commit "A2".

STEP 3: finish

- docs/MANUAL-TEST.md: 10 lines for the owner (two windows on one PC, then a second device) covering: create

  room, copy invite (the link's secret must be 22 chars and the address bar must be clean), join, chat both

  ways, pick the MP4, stream, viewer pause/seek, volumes independent, reload one window.

- STATE.md: 15 lines. Report in 5 lines. STOP. Do not deploy.
