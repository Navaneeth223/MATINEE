# Matinee Deployment Guide

This guide covers deploying Matinee to production: web app to Vercel, edge server to Cloudflare Workers.

## Prerequisites

- Node.js 20+ and pnpm 9+
- GitHub repository (for Vercel)
- Cloudflare account (free tier works)
- Vercel account (free tier works)

## Architecture

```
User (India) <--WebRTC--> User (Thailand)
      ↓                         ↓
  [Web App]  <--WebSocket-->  [Web App]
  (Vercel)                    (Vercel)
      ↓                         ↓
      └─────── [Edge Server] ───┘
              (Cloudflare Workers + Durable Objects)
```

- **Web App**: React SPA hosted on Vercel
- **Edge Server**: WebSocket signaling + room state on Cloudflare Workers
- **WebRTC**: Peer-to-peer video/audio (STUN only, no TURN yet)

## Step 1: Deploy Edge Server to Cloudflare Workers

### 1.1 Install Wrangler CLI

```bash
pnpm install -g wrangler
```

### 1.2 Login to Cloudflare

```bash
wrangler login
```

### 1.3 Deploy

```bash
cd apps/edge
pnpm run deploy
```

This will:
- Build the Worker
- Create Durable Object namespace
- Deploy to `matinee-edge.your-username.workers.dev`

### 1.4 Note the Worker URL

After deployment, note the URL: `https://matinee-edge.YOUR-USERNAME.workers.dev`

You'll need this for the web app.

### 1.5 Custom Domain (Optional)

To use your own domain:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select `matinee-edge`
3. Settings → Domains & Routes → Add Custom Domain
4. Enter your domain (e.g., `edge.matinee.app`)

## Step 2: Deploy Web App to Vercel

### 2.1 Push to GitHub

```bash
git push origin main
```

### 2.2 Import to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `apps/web`
   - **Build Command**: `cd ../.. && pnpm run build:web`
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
   - **Output Directory**: `apps/web/dist`

### 2.3 Configure Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```
# Development proxy (not needed in production)
# VITE_API_PORT=8788
```

The web app automatically uses `window.location` for WebSocket connections, so no manual edge URL configuration is needed.

### 2.4 Configure Custom Domain (Optional)

1. Vercel Dashboard → Settings → Domains
2. Add your domain (e.g., `matinee.app`)
3. Follow DNS instructions

### 2.5 Configure Proxy to Edge Server

Since the web app uses relative WebSocket URLs (`/ws/...`), you need to proxy to your Cloudflare Worker.

Update `vercel.json` with your Worker URL:

```json
{
  "rewrites": [
    {
      "source": "/ws/:path*",
      "destination": "https://matinee-edge.YOUR-USERNAME.workers.dev/ws/:path*"
    },
    {
      "source": "/api/:path*",
      "destination": "https://matinee-edge.YOUR-USERNAME.workers.dev/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Then redeploy:

```bash
git add apps/web/vercel.json
git commit -m "chore: configure production edge proxy"
git push origin main
```

## Step 3: Test Production Deployment

### 3.1 Create Room

1. Open `https://your-app.vercel.app`
2. Click "New room"
3. Copy invite link

### 3.2 Join from Second Device

1. Open invite link on different device/browser
2. Both should show "Connected — ready to watch"

### 3.3 Test Streaming

1. Click "Film or TV" or "Screen share"
2. Select quality preset (High/Medium/Low)
3. Click "Start streaming"
4. Other user should see the stream

### 3.4 Test Camera

1. Click "📷 Start Camera & Mic"
2. Drag face bubbles (S/M/L sizes, circle/square)
3. Test keyboard shortcuts:
   - **Space**: Play/Pause
   - **F**: Fullscreen
   - **M**: Mute/Unmute
   - **←→**: Seek ±10s

## Step 4: Monitoring

### 4.1 Cloudflare Analytics

Workers Dashboard → Analytics:
- Requests per second
- Errors
- Durable Objects usage

### 4.2 Vercel Analytics

Vercel Dashboard → Analytics:
- Page views
- Web Vitals
- Deployment logs

## Troubleshooting

### "Your network needs a relay"

WebRTC connection failed. This happens when:
- Both users are behind symmetric NAT
- Corporate firewalls block UDP

**Solution**: Implement TURN server (not yet done - see `docs/RISKS.md`)

### "Room is full"

Room already has 2 connected users.

**Solution**: Create a new room

### WebSocket connection failed

Check:
1. Edge server deployed: `curl https://matinee-edge.YOUR-USERNAME.workers.dev/health`
2. Vercel proxy configured correctly in `vercel.json`
3. Browser console for CORS errors

### Video not playing

Check:
1. Chrome: Works
2. Safari: Requires HTTPS (Vercel provides this automatically)
3. Firefox: Works
4. Mobile: Requires HTTPS

## Cost Estimates (Free Tier Limits)

### Cloudflare Workers (Free Tier)

- 100,000 requests/day
- 10ms CPU time per request
- 1GB Durable Objects storage
- **Estimate**: ~500 concurrent rooms, 2000 daily active users

### Vercel (Hobby Tier)

- 100GB bandwidth/month
- Unlimited requests
- 100 deployments/day
- **Estimate**: ~10,000 monthly active users

## Scaling Beyond Free Tier

When you exceed free tier limits:

### Cloudflare Workers Paid ($5/month)

- 10M requests/month included
- $0.50 per additional 1M requests
- Durable Objects: $0.15 per 1M reads

### Vercel Pro ($20/month)

- 1TB bandwidth/month
- Unlimited team members
- Advanced analytics

## Security Checklist

- [x] E2EE messaging (Session protocol)
- [x] Room secrets in URL hash (not server-logged)
- [x] Strict Content Security Policy headers
- [x] HTTPS enforced (Vercel + Cloudflare)
- [ ] TURN server authentication (TODO)
- [ ] Rate limiting (TODO)
- [ ] Abuse reporting (TODO)

## Next Steps

1. **TURN Server**: Deploy coturn for relay fallback (see `docs/RISKS.md`)
2. **Custom Domain**: `matinee.app` + `edge.matinee.app`
3. **Monitoring**: Set up Sentry for error tracking
4. **Analytics**: Privacy-friendly analytics (Plausible or Fathom)
5. **Performance**: Enable Cloudflare caching for static assets

## Support

- Documentation: `docs/`
- Issues: GitHub Issues
- Architecture: `docs/adr/`
- Assumptions: `docs/ASSUMPTIONS.md`

---

Built with ❤️ for long-distance couples
