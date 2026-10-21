# Project State

## D0 Progress: Bug reproduced
**Test result**: A creates → "Waiting for partner", B joins → stays "Connecting", never reach "Connected together". No "Room is full" error shown, but connection fails. Confirms StrictMode double-connect bug (different peerIds or closing socket counted).

## Completed
- SLICE 2 core, Server B1 (live capacity), Client B2 (cancelled flag), Styling B3, Source C1 (Film/Screen)
- E2E test created: reproduces bug, has data-testid selectors, invite URL extraction working

## In progress - D0 fixes needed
1. **Client fix**: connect inside setTimeout(0), cancelled flag, peerId read sync before effect (sessionStorage)
2. **Server fix**: capacity = sockets.filter(readyState OPEN).map(peerId).distinct; evict silent >30s on 'full'; client pings every 10s
3. **Test**: run 3x in row, all green

## Next command
Fix apps/web/src/lib/useRoom.ts: wrap connect in setTimeout(0), read peerId synchronously before useEffect

Context: 128K/200K
