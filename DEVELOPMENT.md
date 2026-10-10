# Development Guide

## Getting Started

### Prerequisites
- Node.js 20.18.1+ (specified in `.node-version`)
- pnpm 10.0.0+

### First Time Setup

```bash
# Clone and enter directory
cd d:\Portfolio_Projects\testantigravity\MATINEE

# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Verify everything works
pnpm typecheck
```

## Development Workflow

### Running the Development Servers

```bash
# Start both web and edge servers concurrently
pnpm dev

# Or run individually:
pnpm --filter @matinee/web dev    # Web app on http://localhost:5173
pnpm --filter @matinee/edge dev   # Edge worker on http://localhost:8787
```

### Working on Packages

```bash
# Build a specific package
pnpm --filter @matinee/protocol build

# Watch mode for a package during development
pnpm --filter @matinee/sync-engine build --watch

# Type check a specific package
pnpm --filter @matinee/web typecheck
```

### Project Structure

```
MATINEE/
├── apps/
│   ├── web/                # React frontend
│   │   ├── src/
│   │   │   ├── pages/      # Route pages (Foyer, Theatre, About)
│   │   │   ├── components/ # Reusable UI components
│   │   │   ├── stores/     # Zustand state management
│   │   │   ├── lib/        # Utilities (i18n, capabilities)
│   │   │   └── styles/     # Global CSS + token imports
│   │   └── index.html
│   └── edge/               # Cloudflare Worker
│       ├── src/
│       │   ├── index.ts    # Main worker entry
│       │   └── room-do.ts  # RoomDO Durable Object
│       └── wrangler.toml
├── packages/
│   ├── protocol/           # Shared types
│   ├── sync-engine/        # WebRTC sync logic
│   ├── subtitle-core/      # Subtitle parsing
│   ├── subtitle-pipeline/  # STT + translation
│   └── ui-tokens/          # Design system
├── docs/                   # Architecture & research
└── e2e/                    # End-to-end tests (future)
```

## Adding New Features

### Creating a New Page (Web)

1. Create page component in `apps/web/src/pages/YourPage.tsx`
2. Add route in `apps/web/src/App.tsx`
3. Add translations in `apps/web/src/locales/{en,th,ml}/common.json`

### Adding Types (Protocol)

1. Edit `packages/protocol/src/index.ts`
2. Run `pnpm --filter @matinee/protocol build`
3. Dependent packages auto-rebuild via Turbo pipeline

### Adding API Endpoints (Edge)

1. Add route handler in `apps/edge/src/index.ts`
2. Type your request/response using `@matinee/protocol`
3. Test locally with `pnpm --filter @matinee/edge dev`

### Working with Durable Objects

RoomDO is in `apps/edge/src/room-do.ts`. Key methods:
- `fetch()` - HTTP request handler (WebSocket upgrades)
- `webSocketMessage()` - Hibernation API message handler
- `webSocketClose()` - Connection cleanup
- `webSocketError()` - Error handling

## Monorepo Tips

### Workspace Dependencies

Packages reference each other using `workspace:*`:

```json
{
  "dependencies": {
    "@matinee/protocol": "workspace:*"
  }
}
```

### Turbo Cache

Turbo caches build outputs. To force rebuild:

```bash
pnpm turbo run build --force
```

### TypeScript Project References

The monorepo uses TypeScript project references for incremental builds:
- Each package has `"composite": true` in its `tsconfig.json`
- Root `tsconfig.json` references all packages
- This enables fast, incremental type checking

### Clean Build

```bash
# Clean all build artifacts
pnpm clean

# Remove node_modules and reinstall
rm -rf node_modules
pnpm install
```

## Code Style

### TypeScript
- Strict mode enabled
- ES2022 target
- No `any` types (use `unknown` if necessary)

### React
- Function components only
- Hooks for state management
- Use Zustand for global state

### Imports
- Use `@/` for relative imports within app
- Use `@matinee/package-name` for workspace packages
- Group imports: React → third-party → workspace → relative

## Testing (Future)

```bash
# Run all tests (when implemented)
pnpm test

# Test specific package
pnpm --filter @matinee/subtitle-core test

# E2E tests (when implemented)
pnpm --filter e2e test
```

## Debugging

### Web App
- Use browser DevTools
- React DevTools extension recommended
- Check `http://localhost:5173` in browser console

### Edge Worker
- Wrangler dev provides local runtime
- Console logs appear in terminal
- Use `console.log()` liberally in development

### WebSocket Debugging
- Chrome DevTools → Network → WS filter
- Messages appear in real-time
- Inspector shows frame content

## Environment Variables

### Web App (.env)
Create `apps/web/.env.local`:
```
VITE_API_URL=http://localhost:8787
VITE_WS_URL=ws://localhost:8787
```

### Edge Worker
Create `apps/edge/.dev.vars` for local secrets:
```
ROOM_SECRET=your-dev-secret
TURN_API_KEY=your-turn-key
```

## Common Issues

### Port Already in Use
```bash
# Kill process on port 5173 (web)
npx kill-port 5173

# Kill process on port 8787 (edge)
npx kill-port 8787
```

### TypeScript Errors After Package Update
```bash
# Rebuild all packages
pnpm build

# Clean and rebuild
pnpm clean && pnpm build
```

### Wrangler Authentication
```bash
# Login to Cloudflare (when deploying)
pnpm --filter @matinee/edge wrangler login
```

## Deployment (Future)

### Web App
```bash
# Build production bundle
pnpm --filter @matinee/web build

# Output in apps/web/dist/
```

### Edge Worker
```bash
# Deploy to Cloudflare
pnpm --filter @matinee/edge deploy
```

## Resources

- [Vite Documentation](https://vite.dev/)
- [React 18 Docs](https://react.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Zustand](https://zustand.docs.pmnd.rs/)
- [i18next](https://www.i18next.com/)

## Getting Help

- Review `docs/RESEARCH.md` for technical decisions
- Check `docs/DECISIONS.md` for architecture rationale
- See `docs/ASSUMPTIONS.md` for project constraints

---

Happy coding! 🎬
