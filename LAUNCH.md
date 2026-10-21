# 🚀 Matinee Launch Checklist

This is your pre-launch checklist to ensure Matinee is production-ready.

## ✅ Development Complete

- [x] **Core Streaming**
  - [x] Film/TV file streaming with quality presets
  - [x] Screen share mode
  - [x] Synchronized playback (play/pause/seek)
  - [x] WebRTC peer-to-peer video

- [x] **Camera & Audio**
  - [x] Camera/microphone with getUserMedia
  - [x] Draggable face bubbles (S/M/L, circle/square)
  - [x] Audio level meter
  - [x] Toggle video/audio controls

- [x] **User Interface**
  - [x] Settings panel (volume, quality presets)
  - [x] Keyboard shortcuts (Space/F/M/arrows)
  - [x] Fullscreen support
  - [x] Dark romantic theme (#08070B, #E7C98E, #E07A8F)
  - [x] Presence indicators (You/Partner)
  - [x] Mobile-responsive design

- [x] **Privacy & Security**
  - [x] End-to-end encrypted chat (Session protocol)
  - [x] No account required (instant rooms)
  - [x] Room secrets in URL hash (never server-logged)
  - [x] Security headers in vercel.json

- [x] **Testing**
  - [x] Unit tests (protocol package: 28/28 passing)
  - [x] E2E tests (connection flow, StrictMode bug fixed)
  - [x] TypeScript strict mode (no errors)
  - [x] Production build succeeds (267.75 kB gzipped)

## 🔧 Pre-Deployment Tasks

### 1. Code Quality

- [x] TypeScript compilation passes
- [x] No console errors in production build
- [ ] Run linter: `pnpm run lint` (if configured)
- [ ] Run all tests: `pnpm test`

### 2. Configuration

- [x] `vercel.json` configured with proxy
- [x] `wrangler.toml` ready for Cloudflare
- [x] `.env.example` files created
- [ ] Update `vercel.json` with actual Worker URL (replace `YOUR-USERNAME`)
- [ ] Verify STUN servers work from target regions (India, Thailand)

### 3. Assets

- [ ] **PWA Icons** (see `apps/web/public/ICONS.md`)
  - [ ] icon-192.png (192x192)
  - [ ] icon-512.png (512x512)
  - [ ] screenshot-wide.png (1280x720)
  - [ ] screenshot-narrow.png (750x1334)
- [ ] Favicon (apps/web/public/vite.svg → custom)
- [ ] Social media preview image (og:image)

### 4. Documentation

- [x] README.md (features, architecture, quick start)
- [x] DEPLOY.md (production deployment guide)
- [x] LAUNCH.md (this file)
- [ ] LICENSE file (MIT recommended)
- [ ] CONTRIBUTING.md (if open-sourcing)

### 5. Repository

- [x] Push all commits to GitHub
- [ ] Create GitHub repository description
- [ ] Add topics: `webrtc`, `e2ee`, `streaming`, `long-distance`, `couples`
- [ ] Set up GitHub Issues templates
- [ ] Add `.github/workflows/` for CI (optional)

## 🚀 Deployment Steps

### Step 1: Deploy Edge Server (Cloudflare Workers)

```bash
cd apps/edge
wrangler login
pnpm run deploy
```

**Expected output:**
```
Published matinee-edge (X.XX sec)
https://matinee-edge.YOUR-USERNAME.workers.dev
```

**Verify:**
```bash
curl https://matinee-edge.YOUR-USERNAME.workers.dev/health
# Should return: {"status":"ok"}
```

### Step 2: Update Vercel Config

Update `apps/web/vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/ws/:path*",
      "destination": "https://matinee-edge.YOUR-ACTUAL-USERNAME.workers.dev/ws/:path*"
    },
    {
      "source": "/api/:path*",
      "destination": "https://matinee-edge.YOUR-ACTUAL-USERNAME.workers.dev/api/:path*"
    }
  ]
}
```

Commit:
```bash
git add apps/web/vercel.json
git commit -m "chore: configure production edge URL"
git push origin main
```

### Step 3: Deploy Web App (Vercel)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import GitHub repository
3. Configure:
   - **Root Directory**: `apps/web`
   - **Build Command**: Auto-detected from vercel.json
   - **Framework**: Other
4. Deploy!

**Expected:**
- Build time: ~2 minutes
- Deploy URL: `https://your-project.vercel.app`

### Step 4: Test Production

1. **Connection Test**
   - Open deploy URL
   - Click "New room"
   - Copy invite link
   - Open in incognito window
   - Verify "Connected — ready to watch"

2. **Streaming Test**
   - Start film/TV or screen share
   - Click "Start streaming"
   - Verify video appears on other client
   - Test play/pause/seek sync

3. **Camera Test**
   - Click "📷 Start Camera & Mic"
   - Verify face bubbles appear
   - Test drag-and-drop positioning
   - Test video/audio toggle

4. **Keyboard Shortcuts**
   - Space → Play/Pause
   - F → Fullscreen
   - M → Mute
   - ←→ → Seek

5. **Settings Panel**
   - Click ⚙️ button
   - Adjust volume slider
   - Change quality preset
   - Verify shortcuts list

### Step 5: Performance Check

- [ ] Lighthouse score > 90 (Performance, Accessibility, SEO)
- [ ] First Contentful Paint < 1.5s
- [ ] WebSocket connection < 500ms (India-Thailand)
- [ ] Video stream starts < 3s after "Start streaming"

### Step 6: Cross-Browser Test

- [ ] Chrome (Windows, macOS, Android)
- [ ] Safari (macOS, iOS)
- [ ] Firefox (Windows, macOS)
- [ ] Edge (Windows)
- [ ] Mobile Safari (iOS) — requires HTTPS ✓ (Vercel provides)

## 📊 Monitoring Setup

### Cloudflare Workers Analytics

1. Dashboard → Workers & Pages → matinee-edge
2. Metrics → Enable
3. Set alerts:
   - Error rate > 5%
   - CPU time > 50ms average

### Vercel Analytics

1. Dashboard → Analytics → Enable
2. Monitor:
   - Page views
   - Unique visitors
   - Web Vitals (LCP, FID, CLS)

### Optional: Error Tracking

- [ ] Sentry integration (recommended)
- [ ] LogRocket for session replay
- [ ] PostHog for product analytics (privacy-friendly)

## 🎉 Launch Day

### Pre-Launch (1 hour before)

- [ ] Final production test (all browsers)
- [ ] Verify Cloudflare Worker is running
- [ ] Verify Vercel deployment is live
- [ ] Test from actual target locations (India, Thailand if possible)
- [ ] Prepare announcement tweet/post

### Launch

1. **Announce**
   - Tweet with screenshots
   - Post to Product Hunt (optional)
   - Share on Hacker News (Show HN)
   - Post in relevant subreddits (r/webdev, r/LongDistance)

2. **Monitor**
   - Watch Vercel deployment logs
   - Watch Cloudflare Workers analytics
   - Monitor GitHub Issues for bug reports

3. **Respond**
   - Reply to feedback quickly
   - Fix critical bugs within 24 hours
   - Acknowledge feature requests

### Post-Launch (First 48 Hours)

- [ ] Create GitHub Issues for reported bugs
- [ ] Update README with real user count (if any)
- [ ] Collect feedback for v2 roadmap
- [ ] Write launch retrospective (docs/LAUNCH-RETRO.md)

## 🐛 Known Issues (Acceptable for V1)

These are documented but not blockers:

1. **"Your network needs a relay"** — No TURN server yet
   - Affects: ~15% of users behind symmetric NAT
   - Workaround: None (future v2 feature)
   - Documented: RISKS.md

2. **No persistent chat history** — By design (privacy)
   - Messages disappear when users leave
   - Feature, not bug

3. **No subtitle support** — Implemented but not wired up
   - Code exists in `packages/subtitle-core`
   - Future v1.1 feature

4. **No mobile app** — PWA only
   - Can be "installed" via browser
   - Native app is v2 goal

## 🎯 Success Metrics

### Week 1 Goals

- [ ] 10 successful room creations
- [ ] 5 successful India-Thailand connections
- [ ] 0 critical bugs (P0: app unusable)
- [ ] < 5 minor bugs (P1: annoying but usable)

### Month 1 Goals

- [ ] 100 unique visitors
- [ ] 50 successful video streams
- [ ] 5 GitHub stars
- [ ] Listed on WebRTC Samples showcase

## 🚨 Rollback Plan

If critical issues arise:

1. **Vercel Rollback**
   - Dashboard → Deployments → Previous deployment → Promote
   - Takes ~30 seconds

2. **Cloudflare Rollback**
   ```bash
   wrangler rollback --message "Critical bug: describe issue"
   ```

3. **Communication**
   - Tweet: "Investigating issue, rolling back"
   - GitHub Issue: Describe problem + ETA

## 📞 Emergency Contacts

- **Cloudflare Status**: https://www.cloudflarestatus.com
- **Vercel Status**: https://www.vercel-status.com
- **GitHub**: Your repository Issues tab

---

## ✅ Ready to Launch?

Once all checkboxes above are ✓, you're ready!

```bash
# Final commit
git add -A
git commit -m "chore: ready for production launch 🚀"
git push origin main

# Then deploy per Step 1-3 above
```

**Good luck! 🎬💕**

---

Built with ❤️ for long-distance couples everywhere.
