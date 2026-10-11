# Matinee Deployment Guide

**Target:** Cloudflare Workers + Pages (free tier)  
**Status:** M2 ready for deployment  
**Last updated:** 2026-10-10

---

## Prerequisites

- [x] M2 implementation complete
- [ ] Cloudflare account (free, no credit card required for M2)
- [ ] Node.js 18+ and pnpm installed
- [ ] Git repository committed and clean

---

## Part 1: Deploy Cloudflare Worker (Backend)

The Worker handles WebSocket connections, room creation, and E2EE key relay.

### Step 1: Install Wrangler CLI

```bash
pnpm install -g wrangler
```

### Step 2: Authenticate with Cloudflare

```bash
wrangler login
```

This opens a browser window for OAuth authentication. Sign in with your Cloudflare account.

### Step 3: Configure Worker

Check `apps/edge/wrangler.toml`:

```toml
name = "matinee-edge"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "ROOM", class_name = "RoomDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["RoomDO"]
```

### Step 4: Deploy Worker

```bash
cd apps/edge
pnpm run deploy
```

This runs `wrangler deploy` and publishes your Worker to Cloudflare.

**Expected output:**
```
✨ Build succeeded
✨ Built successfully
✨ Successfully published your script to
   https://matinee-edge.<your-subdomain>.workers.dev
```

**Record this URL** — you'll need it for the web app configuration.

### Step 5: Test Worker

```bash
curl https://matinee-edge.<your-subdomain>.workers.dev/health
```

Expected response:
```json
{"status":"ok"}
```

Test room creation:
```bash
curl -X POST https://matinee-edge.<your-subdomain>.workers.dev/api/rooms \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "inviteUrl": "https://matinee.example.com/room/550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Part 2: Deploy Web App (Frontend)

### Option A: Cloudflare Pages (Recommended)

#### Step 1: Build Web App

```bash
cd apps/web
pnpm run build
```

This creates `apps/web/dist/` with static assets.

#### Step 2: Update API URL

Before deploying, configure the web app to use your deployed Worker URL.

Create `apps/web/.env.production`:

```env
VITE_API_BASE_URL=https://matinee-edge.<your-subdomain>.workers.dev
VITE_WS_BASE_URL=wss://matinee-edge.<your-subdomain>.workers.dev
```

Rebuild:
```bash
pnpm run build
```

#### Step 3: Deploy to Cloudflare Pages

```bash
wrangler pages deploy dist --project-name=matinee-web
```

**First deployment:** Wrangler will prompt to create a new Pages project. Accept defaults.

**Expected output:**
```
✨ Deployment complete!
   https://matinee-web.pages.dev
```

#### Step 4: Configure Custom Domain (Optional)

1. Go to Cloudflare dashboard → Pages → matinee-web
2. Navigate to Custom domains
3. Add your domain (requires DNS managed by Cloudflare)
4. Follow prompts to verify and activate

### Option B: Static File Hosting (Alternative)

If Cloudflare Pages has issues, you can deploy the `apps/web/dist/` folder to:
- **Vercel:** `vercel deploy`
- **Netlify:** `netlify deploy`
- **GitHub Pages:** Push dist folder to gh-pages branch

Make sure to set `VITE_API_BASE_URL` and `VITE_WS_BASE_URL` environment variables before building.

---

## Part 3: Post-Deployment Verification

### Test 1: Create Room from Production
1. Navigate to `https://matinee-web.pages.dev` (or your deployed URL)
2. Click "Create Room"
3. Verify room ID appears
4. Verify invite URL is copyable

### Test 2: Join from Second Device/Browser
1. Copy invite URL from Test 1
2. Open in a second browser or device (e.g., MacBook, phone)
3. Verify both peers appear in peer list
4. Verify connection status reaches "Ready" (green)

### Test 3: Network Inspection
1. Open DevTools → Network → WS filter
2. Verify WebSocket connection to Worker
3. Check messages: `peer-joined`, `key-exchange`
4. Confirm no plaintext in Worker logs (E2EE verification)

### Test 4: Cross-Network (Two Different Networks)
1. Connect Device A on home WiFi
2. Connect Device B on mobile hotspot or different WiFi
3. Verify peers can connect and reach "Ready" state
4. This validates STUN-based P2P connectivity

---

## Part 4: Environment Variables Summary

### Development (.env.local)
```env
VITE_API_BASE_URL=http://localhost:8787
VITE_WS_BASE_URL=ws://localhost:8787
```

### Production (.env.production)
```env
VITE_API_BASE_URL=https://matinee-edge.<your-subdomain>.workers.dev
VITE_WS_BASE_URL=wss://matinee-edge.<your-subdomain>.workers.dev
```

**Where to set in Cloudflare Pages:**
1. Dashboard → Pages → matinee-web → Settings → Environment variables
2. Add both variables with production values
3. Rebuild and redeploy

---

## Part 5: Monitoring & Quotas

### Check Cloudflare Usage
1. Dashboard → Workers & Pages → Overview
2. Monitor:
   - **Requests:** Should stay under 100,000/day (free tier)
   - **Duration:** Durable Objects should stay under 400,000 GB-seconds/month
   - **Errors:** Watch for 1027 errors (quota exceeded)

### Recommended Alerts
Set up notifications in Cloudflare:
- Alert when requests exceed 80,000/day (80% of quota)
- Alert on any Worker errors

### Logs
View Worker logs:
```bash
wrangler tail matinee-edge
```

This streams real-time logs from your deployed Worker.

---

## Rollback Procedure

If deployment has issues:

### Rollback Worker
```bash
cd apps/edge
wrangler rollback
```

### Rollback Pages
```bash
wrangler pages deployment list --project-name=matinee-web
wrangler pages deployment rollback <deployment-id> --project-name=matinee-web
```

Or use Cloudflare dashboard → Pages → matinee-web → Deployments → Rollback

---

## Troubleshooting

### Issue: "No credit card on file"
**Symptom:** Deployment blocked by card requirement  
**Action:** STOP. Do not add card. This violates M2 free-tier requirement.  
**Report:** Document exact error message and which feature triggered it.

### Issue: CORS errors in browser console
**Symptom:** `Access-Control-Allow-Origin` errors  
**Fix:** Verify Worker response includes CORS headers (should be in `apps/edge/src/index.ts`)

### Issue: WebSocket connection fails
**Symptom:** Connection stays in "Connecting" state  
**Check:**
1. Worker deployed successfully
2. `VITE_WS_BASE_URL` uses `wss://` (not `ws://`)
3. Browser DevTools → Network → WS tab shows connection attempt
4. Cloudflare dashboard → Workers → Logs shows connection accepted

### Issue: Peers don't see each other
**Symptom:** Peer list empty or incomplete  
**Check:**
1. Both browsers reached `/room/:roomId` successfully
2. Both WebSocket connections established (check Network tab)
3. Worker logs show both connections accepted
4. No JavaScript errors in browser console

### Issue: Key exchange fails
**Symptom:** Connection status stuck on "Connected" (blue), never reaches "Ready" (green)  
**Check:**
1. Browser console for crypto errors
2. SubtleCrypto available (HTTPS or localhost required)
3. `key-exchange` messages sent/received (Network → WS → Messages)

---

## Cost Monitoring

### M2 Expected Usage (per session)
- **Requests:** ~150 WebSocket messages per 2-hour session
- **Duration:** ~2 hours of active Durable Object per session
- **Storage:** Minimal (peer list only, no persistence)

### Free Tier Capacity
- **100,000 requests/day** = ~666 concurrent 2-hour sessions per day (plenty)
- **400,000 GB-seconds/month** = ~185,000 hours of DO time per month

**Verdict:** Free tier is sufficient for personal use and small-scale testing. Production scale will require monitoring.

---

## Next Steps After Deployment

1. Complete M3-PREP.md checklist:
   - [x] Deploy M2 to production
   - [ ] Run Spike S5 (captureStream test)
   - [ ] Run Spike S1 (two-network WebRTC test)
2. Test deployed M2 with two devices on different networks
3. Measure real-world latency and connection success rate
4. Proceed to M3 implementation once prerequisites complete

---

**Deployment support:** If you encounter issues, check Cloudflare Workers documentation or Matinee project issues.
