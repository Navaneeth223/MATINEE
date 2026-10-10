# Matinee

Watch films together, anywhere. Synchronized playback with WebRTC, automatic multilingual subtitles, and end-to-end encryption.

## Prerequisites

- Node.js 20.18.1 or higher (LTS)
- pnpm 10.0.0 or higher

## Setup

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development servers
pnpm dev
```

## Development

```bash
# Run web app only
pnpm --filter @matinee/web dev

# Run edge worker only
pnpm --filter @matinee/edge dev

# Type check all packages
pnpm typecheck

# Build specific package
pnpm --filter @matinee/protocol build
```

## Project Structure

- **packages/protocol** — Shared TypeScript types and WebSocket message schemas
- **packages/sync-engine** — WebRTC-based playback synchronization logic
- **packages/subtitle-core** — Subtitle parsing, formatting, and validation
- **packages/subtitle-pipeline** — Whisper.js orchestration for subtitle generation
- **packages/ui-tokens** — Design tokens (colors, typography, spacing) as CSS custom properties and TS constants
- **apps/web** — React 18 + Vite frontend with i18n support (EN, TH, ML)
- **apps/edge** — Cloudflare Worker with Durable Objects for room coordination

## Architecture

See [docs/](./docs/) for design decisions, research notes, and API specifications.

## Verification Checklist

- ✅ `pnpm install` completes with no errors
- ✅ `pnpm build` compiles all packages
- ✅ `pnpm typecheck` passes with zero TypeScript errors
- ✅ `pnpm dev` starts both web and edge servers
- ✅ Web app accessible at http://localhost:5173
- ✅ Edge API accessible at http://localhost:8787

## Next Steps

- Review [DECISIONS.md](./docs/DECISIONS.md) for architectural choices
- Check [RESEARCH.md](./docs/RESEARCH.md) for technical research
