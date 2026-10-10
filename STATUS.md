# Matinee Project Status

> Last updated: 2026-10-10

## ✅ Phase 0: Foundation Complete

The Matinee monorepo is fully scaffolded and ready for feature development.

### Infrastructure Ready

- **Monorepo**: pnpm workspaces with Turbo pipeline
- **TypeScript**: v5.9.3 strict mode across all packages
- **Build System**: All packages compile cleanly
- **Development**: Hot reload with Vite (web) and Wrangler (edge)
- **Version Control**: Git initialized with proper .gitignore

### Packages Built (5)

1. **@matinee/protocol** ✅
   - WebSocket message types
   - Room state interfaces
   - Sync protocol types
   - E2EE envelope schemas

2. **@matinee/sync-engine** ✅
   - Playback state types
   - Drift controller interfaces
   - WebRTC coordination stubs

3. **@matinee/subtitle-core** ✅
   - Subtitle format types (SRT/VTT/ASS)
   - Cue object model
   - Timing validation interfaces

4. **@matinee/subtitle-pipeline** ✅
   - Whisper orchestration types
   - Audio extraction interfaces
   - Translation pipeline stubs

5. **@matinee/ui-tokens** ✅
   - Design tokens (colors, spacing, typography)
   - Cinematic warm theme
   - CSS custom properties

### Applications Built (2)

1. **@matinee/web** ✅
   - React 18 + Vite
   - React Router with pages: Foyer, Theatre, About, 404
   - Zustand stores (room, user-prefs, subtitle)
   - i18next (EN, TH, ML locales)
   - Capability detection utility
   - Design tokens integration

2. **@matinee/edge** ✅
   - Cloudflare Worker entry point
   - RoomDO Durable Object class with Hibernation API
   - API route stubs: `/api/rooms`, `/api/ice`, `/ws/:roomId`
   - Workers Assets binding for serving web app

### Verification Results

```bash
✅ pnpm install          # Completes successfully
✅ pnpm build           # All packages compile
✅ pnpm typecheck       # Zero TypeScript errors
✅ Web app builds       # 231 kB bundle (75.84 kB gzipped)
✅ Edge worker compiles # Ready for wrangler dev
```

## 🚧 Next: Core Features

The foundation is ready. Here are the logical next steps:

### Priority 1: WebRTC Sync Engine
- Implement perfect negotiation pattern
- Build drift controller (anchor-time + rate adjustment)
- Scheduled command execution
- RTT measurement and adaptive scheduling

### Priority 2: Room Coordination
- RoomDO WebSocket message handling
- Room state persistence (Hibernation API)
- Peer join/leave/presence
- ICE credential endpoint implementation

### Priority 3: Basic UI Flow
- Foyer: File selection, room creation
- Theatre: Video player, sync controls
- Connection status indicators
- Basic peer presence display

### Priority 4: E2EE Foundation
- ECDH P-256 key exchange
- AES-GCM encryption/decryption
- Sealed envelope routing through RoomDO

### Priority 5: Subtitle Generation
- Audio extraction (WebCodecs primary)
- Whisper.js integration (@huggingface/transformers v4)
- SRT/VTT parser implementation
- Translation ladder (Gemini → NLLB → fallback)

## 📋 Quick Start

```bash
# Install dependencies
pnpm install

# Start both web and edge dev servers
pnpm dev

# Or start individually:
pnpm --filter @matinee/web dev    # http://localhost:5173
pnpm --filter @matinee/edge dev   # http://localhost:8787

# Type check everything
pnpm typecheck

# Build for production
pnpm build
```

## 📚 Documentation

- **Architecture**: See [docs/DECISIONS.md](./docs/DECISIONS.md) for ADRs
- **Research**: See [docs/RESEARCH.md](./docs/RESEARCH.md) for technical findings
- **Competition**: See [docs/COMPETITORS.md](./docs/COMPETITORS.md) for market analysis
- **Assumptions**: See [docs/ASSUMPTIONS.md](./docs/ASSUMPTIONS.md) for project constraints

## 🎯 Ready For

- Feature implementation
- Integration testing setup
- CI/CD pipeline configuration
- Cloudflare account setup (when needed)
- API key configuration (TMDB, Gemini)

---

**Status**: Foundation complete, ready for feature development 🚀
