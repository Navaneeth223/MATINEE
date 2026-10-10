# Matinee monorepo scaffold

The scaffold creates a working pnpm monorepo with 5 packages, 2 apps (React frontend and Cloudflare Workers edge runtime), Turbo build orchestration, and TypeScript project references. All builds pass, workspace dependencies resolve correctly, and the structure matches the scaffolding requirements. The protocol package exports real typed interfaces instead of stubs with `any`, RoomDO uses Cloudflare's Hibernation API for WebSocket management, and workspace dependencies use `workspace:*` throughout. The web app has all required files (Vite config, HTML entry, React components, i18n setup, Zustand stores, locale files for EN/TH/ML, pages for foyer/theatre/about/404), and the edge worker has wrangler.toml with Durable Objects bindings and a functional DO implementation.

**Watch for:** Nothing blocking. This is a clean scaffold with all required structure in place and all builds passing. No feature implementation was attempted (correct for scaffolding phase).

**Verdict**: APPROVED

## High-level view

The monorepo uses pnpm workspaces with Turborepo for task orchestration across 5 shared packages and 2 apps. Workspace dependencies are wired with `workspace:*` protocol so internal changes trigger rebuilds. The protocol package defines WebSocket message schemas and room state types used across both frontend and backend. The edge worker uses Cloudflare Durable Objects with Hibernation API (`state.acceptWebSocket`, `state.getWebSockets`) for persistent WebSocket sessions that survive DO hibernation. The web app is a Vite-powered React SPA with react-router-dom, Zustand for state, and i18next configured with three locales. TypeScript strict mode is enabled everywhere and project references wire the build dependency graph.

<details>
<summary>Issues (0)</summary>

No blocking issues found.

</details>

<details>
<summary>Details</summary>

## Workspace structure and wiring

The pnpm-workspace.yaml covers `packages/*` and `apps/*`, and all 7 workspaces have valid package.json files. Internal dependencies use `workspace:*` throughout: apps/web depends on all 5 packages, apps/edge depends on protocol, and sync-engine depends on protocol. Turbo.json configures build tasks with `^build` dependency so packages build before their consumers. All package.json exports point to `dist/index.js` with `.d.ts` types. TypeScript strict mode is enabled with project references. The verification log confirms all 9 steps passed.

## Protocol package types

The protocol package exports 14 concrete types with no use of `any`. The message types cover join/leave, sync, chat, ICE negotiation, signaling, and ping/pong. Playback state has 6 distinct statuses (idle, loading, playing, paused, buffering, ended) and tracks current time, duration, and playback rate.

## RoomDO Hibernation API usage

The RoomDO class uses Cloudflare's Hibernation API correctly. The constructor calls `state.getWebSockets()` to restore sessions after hibernation, deserializes the attached Peer metadata, and rebuilds the sessions map. The fetch handler calls `state.acceptWebSocket(server)` to register the WebSocket with the hibernation system before serializing the peer attachment. The webSocketMessage handler broadcasts to `state.getWebSockets()` instead of the local sessions map, ensuring it sees all active connections including those restored from hibernation. The DO implements the three WebSocket lifecycle methods (message, close, error) required by the runtime.

The wrangler.toml binds the DO as `ROOM_DO` with a v1 migration declaring it as a SQLite-backed class. The edge index.ts routes `/ws/:roomId` requests to the DO by name-based ID, which gives each room a singleton DO instance.

## Web app structure

The apps/web has all required files. The index.html references `/src/main.tsx` as entry point with viewport meta for notch/safe-area support. Main.tsx initializes React with BrowserRouter, imports global CSS and i18n side effect. App.tsx defines 4 routes: `/` (FoyerPage), `/room/:roomId` (TheatrePage), `/about` (AboutPage), and `*` (NotFoundPage). All 4 page components exist. The lib/i18n.ts configures i18next with 3 locales (en/th/ml) and all locale files exist. The lib/capabilities.ts detects WebGPU, WebCodecs, Wake Lock, File System Access, captureStream, and identifies Safari and mobile. Three Zustand stores exist: roomStore (tracks roomId, peers, playback, hostPeerId), subtitleStore, and userPrefsStore.

## Edge worker structure

The apps/edge has wrangler.toml, src/index.ts, and src/room-do.ts. The wrangler config binds the RoomDO and declares an assets binding for static files. The index.ts default export handles 3 routes: POST /api/rooms (creates room ID), GET /api/ice (returns STUN servers with comment noting TURN credentials come from Cloudflare Realtime API later), and /ws/:roomId (proxies to RoomDO).

## README and documentation

The README has setup instructions (pnpm install, pnpm build, pnpm dev), lists all 7 workspaces with descriptions, shows per-package dev commands, and includes a verification checklist with 6 items all marked completed.

</details>

<details>
<summary>File Map</summary>

### Root configuration
- `pnpm-workspace.yaml` — workspace glob patterns
- `turbo.json` — build task dependencies
- `package.json` — workspace scripts and Turbo
- `tsconfig.json` — project references config
- `.gitignore` — standard Node/pnpm/TS/Wrangler ignores
- `.node-version` — Node 20.18.1
- `README.md` — setup and verification instructions

### packages/protocol
- `package.json` — exports, build script
- `src/index.ts` — WebSocket messages, room state, sync protocol, E2EE types

### packages/sync-engine
- `package.json` — depends on protocol
- `src/index.ts` — drift controller interface, config factory, anchor time utils

### packages/subtitle-core
- `package.json` — no dependencies
- `src/index.ts` — Cue, Track, formatting rules for EN/TH/ML

### packages/subtitle-pipeline
- `package.json` — no dependencies inspected
- `src/index.ts` — not inspected (builds passed)

### packages/ui-tokens
- `package.json` — copies tokens.css to dist
- `src/index.ts` — not inspected (builds passed)
- `tokens.css` — not inspected

### apps/web
- `package.json` — depends on all 5 packages, React, Vite, router, Zustand, i18next
- `vite.config.ts` — React plugin, path alias, ES2022 target
- `index.html` — entry point, manifest link
- `src/main.tsx` — React root, BrowserRouter, i18n init
- `src/App.tsx` — 4 routes
- `src/pages/*.tsx` — FoyerPage, TheatrePage, AboutPage, NotFoundPage
- `src/lib/i18n.ts` — i18next config with 3 locales
- `src/lib/capabilities.ts` — feature detection
- `src/stores/*.ts` — roomStore, subtitleStore, userPrefsStore
- `src/locales/*.json` — en, th, ml translations
- `src/styles/global.css` — global styles

### apps/edge
- `wrangler.toml` — DO binding, assets binding, v1 migration
- `src/index.ts` — room creation, ICE, WebSocket routing
- `src/room-do.ts` — Hibernation API WebSocket handling

### Verification artifacts
- `.agents/tasks/verification.md` — 9 passing steps

Full diff: all files are new (scaffold from empty repo).

</details>
