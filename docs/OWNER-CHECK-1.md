# OWNER CHECK 1: Manual M2 Test

PW-01..04 harness works but tests need debugging. Manual verification:

1. `cd apps/edge && pnpm run dev` (port 8788)
2. `cd apps/web && pnpm run dev` (port 5173)  
3. Open http://localhost:5173, click "Create Room", click Copy button
4. Open new incognito window, paste invite URL - both show "Connected", chat works both ways
5. Open 3rd incognito window with same invite - shows "room full" or "Error: Room full"

**Pass criteria:** Steps 1-5 work; fragment #k= removed from address bar after join; wrong secret refused.

**If passing:** Continue to SLICE 1 (feasibility spike).
**If failing:** Report which step and what you see.
