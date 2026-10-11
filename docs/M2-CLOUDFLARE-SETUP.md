# M2 Cloudflare Account Setup

**Required by:** Gate A condition 4  
**Date:** 2026-10-10

## Gate Check: Does Cloudflare Signup Require a Card?

**STOP HERE IF A CARD IS REQUESTED. Report to owner before proceeding.**

## Steps

1. Navigate to https://dash.cloudflare.com/sign-up
2. Enter email address and password
3. Verify email (check inbox)
4. **At each step: note whether a credit card is requested**
   - If YES at any step → **STOP. Document the exact screen/prompt and notify owner.**
   - If NO → proceed
5. After account creation, navigate to Workers & Pages
6. Note whether Workers free tier is available without a card

## What We Know (as of 2026-10-10)

- Cloudflare Workers + Durable Objects **free tier** does NOT require a credit card for standard signup.
- The free tier includes: 100,000 requests/day, 128 MB memory, Durable Objects with 1 GB storage.
- Services that DO require a card: Cloudflare Realtime TURN, R2 over quota, specific paid add-ons.
- Source: Cloudflare pricing page (https://developers.cloudflare.com/workers/platform/pricing/)
- Exact line from Cloudflare R2 pricing: "Cloudflare requires a credit card to enable R2" — this is R2-specific, not Workers signup.

## If Signup Requires a Card

Report to owner immediately. Do not proceed with M2 until owner confirms.

Alternative if blocked:
- Use local Miniflare for development and defer deployment.
- Evaluate Deno Deploy as a DO-compatible alternative.

## M2 Wrangler Setup (After Account Confirmed)

```bash
# Install wrangler (already present in monorepo dev deps)
npm install -g wrangler

# Login
wrangler login

# Verify account
wrangler whoami

# Deploy edge worker
cd apps/edge
npx wrangler deploy
```

## Account Status

- [ ] Account created (no card required — confirmed)
- [ ] Email verified
- [ ] Workers free tier confirmed
- [ ] Wrangler authenticated
- [ ] Worker deployed
