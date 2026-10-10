# Implementation Plan — Matinee Monorepo Scaffold

> This plan creates the complete monorepo structure with zero features, only wiring and verification.
> Constraints: Windows paths (absolute), pnpm workspaces, TypeScript strict mode, Node 20 LTS.
> Every step leaves the codebase buildable. Every package has a minimal 'hello world' export to verify imports.

---

## PHASE 1 — Root Configuration

- [ ] 1. Create root package.json with pnpm workspaces configuration.
      Set up workspace roots for apps/* and packages/*, with Node 20 engine requirement.
      Scripts: `dev` (placeholder), `build` (turbo build), `test` (turbo test), `typecheck` (turbo typecheck), `clean` (turbo clean).
      DevDependencies: `typescript@5.9.3`, `turbo@^2.3.3`, `prettier@^3.4.2`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\package.json`
      Verify: Run `pnpm install` at root — must succeed with no errors.

- [ ] 2. Create pnpm-workspace.yaml defining workspace packages.
      Include `packages/*` and `apps/*`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\pnpm-workspace.yaml`
      Verify: `pnpm install` still succeeds; `pnpm list --depth=0` shows workspace structure.

- [ ] 3. Create root tsconfig.json with strict mode and modern target.
      Target: `ES2022`, module: `ESNext`, moduleResolution: `bundler`, strict: `true`, skipLibCheck: `true`.
      Include composite project references preparation (not yet wired).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\tsconfig.json`
      Verify: File parses correctly — `npx tsc --showConfig` at root produces valid output.

- [ ] 4. Create .gitignore for Node.js, pnpm, TypeScript, Wrangler, OS files.
      Ignore: `node_modules/`, `dist/`, `build/`, `.turbo/`, `*.log`, `.env*`, `.wrangler/`, `.DS_Store`, `Thumbs.db`, `pnpm-lock.yaml` (do NOT ignore; remove from list).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\.gitignore`
      Verify: `git status` at root shows only tracked files; `.gitignore` itself should appear.

- [ ] 5. Create turbo.json defining the monorepo build pipeline.
      Pipeline tasks: `build` (depends on `^build`), `typecheck`, `test`, `dev` (cache: false, persistent: true), `clean`.
      Outputs: `["dist/**", "build/**", ".next/**"]`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\turbo.json`
      Verify: `pnpm turbo run build --dry-run` outputs task graph with no errors.

- [ ] 6. Create .node-version specifying Node 20 LTS.
      Content: `20.18.1` (current LTS as of 2026-10).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\.node-version`
      Verify: `node --version` shows v20.x; file exists.

- [ ] 7. Create root README.md with setup instructions for new contributors.
      Sections: Project overview, Prerequisites (Node 20, pnpm 10), Setup (`pnpm install`), Development (`pnpm --filter <pkg> dev`), Testing, Architecture links to docs/.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\README.md`
      Verify: File renders correctly in GitHub preview; no broken links.

---

## PHASE 2 — Shared Packages (Dependency Order)

- [ ] 8. Create packages/protocol with TypeScript types and schemas.
      Package.json: name `@matinee/protocol`, version `0.0.0`, type `module`, main `./dist/index.js`, types `./dist/index.d.ts`, exports `{ ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`.
      Dependencies: none.
      DevDependencies: `typescript@5.9.3`.
      Scripts: `build` (`tsc`), `typecheck` (`tsc --noEmit`).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\protocol\package.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\packages\protocol\tsconfig.json` (extends root, sets `composite: true`, `outDir: "./dist"`, `rootDir: "./src"`).
      Create `src/index.ts` exporting placeholder types: `export type MessageType = 'join' | 'leave' | 'sync' | 'chat';`, `export interface Peer { id: string; joinedAt: number; }`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\protocol\src\index.ts`
      Verify: `pnpm --filter @matinee/protocol build` — compiles without errors; `dist/index.js` and `dist/index.d.ts` exist.

- [ ] 9. Create packages/sync-engine with WebRTC synchronization types.
      Package.json: name `@matinee/sync-engine`, version `0.0.0`, type `module`, main `./dist/index.js`, types `./dist/index.d.ts`.
      Dependencies: `@matinee/protocol: workspace:*`.
      DevDependencies: `typescript@5.9.3`.
      Scripts: `build`, `typecheck`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\sync-engine\package.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\packages\sync-engine\tsconfig.json` (extends root, composite, references `@matinee/protocol`).
      Create `src/index.ts` exporting placeholder: `export interface DriftController { readonly anchorTime: number; }`, `export type PlaybackState = 'idle' | 'playing' | 'paused';`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\sync-engine\src\index.ts`
      Verify: `pnpm --filter @matinee/sync-engine build` — compiles; imports from `@matinee/protocol` resolve correctly.

- [ ] 10. Create packages/subtitle-core with subtitle parsing interfaces.
      Package.json: name `@matinee/subtitle-core`, version `0.0.0`, type `module`.
      Dependencies: none (pure TS).
      DevDependencies: `typescript@5.9.3`.
      Scripts: `build`, `typecheck`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\subtitle-core\package.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\packages\subtitle-core\tsconfig.json`.
      Create `src/index.ts` with placeholder types: `export interface Cue { start: number; end: number; text: string; }`, `export type SubtitleFormat = 'srt' | 'vtt' | 'ass';`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\subtitle-core\src\index.ts`
      Verify: `pnpm --filter @matinee/subtitle-core build` — compiles cleanly.

- [ ] 11. Create packages/subtitle-pipeline with subtitle generation coordination.
      Package.json: name `@matinee/subtitle-pipeline`, version `0.0.0`, type `module`.
      Dependencies: `@matinee/subtitle-core: workspace:*`, `@matinee/protocol: workspace:*`.
      DevDependencies: `typescript@5.9.3`, `@types/node@^24.1.0`.
      Scripts: `build`, `typecheck`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\subtitle-pipeline\package.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\packages\subtitle-pipeline\tsconfig.json` (composite, references both deps).
      Create `src/index.ts` with placeholder: `export interface WhisperOrchestrator { processAudio(buffer: ArrayBuffer): Promise<string[]>; }`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\subtitle-pipeline\src\index.ts`
      Verify: `pnpm --filter @matinee/subtitle-pipeline build` — compiles; workspace dependencies resolve.

- [ ] 12. Create packages/ui-tokens with design tokens as CSS custom properties and TS constants.
      Package.json: name `@matinee/ui-tokens`, version `0.0.0`, type `module`.
      Dependencies: none.
      DevDependencies: `typescript@5.9.3`.
      Scripts: `build` (copy CSS to dist and compile TS), `typecheck`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\ui-tokens\package.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\packages\ui-tokens\tsconfig.json`.
      Create `src/tokens.css` with placeholder: `:root { --color-bg: #1a1a1a; --color-text: #f5f5f5; --spacing-sm: 0.5rem; }`.
      Create `src/index.ts` exporting: `export const colors = { bg: 'var(--color-bg)', text: 'var(--color-text)' } as const;`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\packages\ui-tokens\src\tokens.css`, `d:\Portfolio_Projects\testantigravity\MATINEE\packages\ui-tokens\src\index.ts`
      Verify: `pnpm --filter @matinee/ui-tokens build` — CSS and JS artifacts in dist/.

---

## PHASE 3 — Web Application

- [ ] 13. Create apps/web with Vite + React 18 scaffolding.
      Package.json: name `@matinee/web`, version `0.0.0`, type `module`, private `true`.
      Dependencies: `react@^18.3.1`, `react-dom@^18.3.1`, `react-router-dom@^7.5.1`, `zustand@^5.0.3`, `i18next@^24.3.2`, `react-i18next@^15.3.2`, `@matinee/protocol: workspace:*`, `@matinee/sync-engine: workspace:*`, `@matinee/subtitle-core: workspace:*`, `@matinee/subtitle-pipeline: workspace:*`, `@matinee/ui-tokens: workspace:*`.
      DevDependencies: `typescript@5.9.3`, `vite@^6.1.5`, `@vitejs/plugin-react@^4.4.2`, `@types/react@^19.0.10`, `@types/react-dom@^19.0.3`.
      Scripts: `dev` (`vite`), `build` (`tsc && vite build`), `typecheck` (`tsc --noEmit`), `preview` (`vite preview`).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\package.json`
      Verify: Package file parses; `pnpm install` at root pulls all deps.

- [ ] 14. Create apps/web Vite configuration with path aliases and CSP prep.
      vite.config.ts: React plugin, resolve aliases (`@/` -> `./src/`, `@matinee/*` mapped), define `__DEV__` global, server port 5173.
      Placeholder CSP comment for future headers.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\vite.config.ts`
      Verify: Vite config loads without error — `pnpm --filter @matinee/web dev` starts but exits (no index.html yet).

- [ ] 15. Create apps/web tsconfig.json extending root with React and path mappings.
      Extends `../../tsconfig.json`, jsx: `react-jsx`, lib: `["ES2022", "DOM", "DOM.Iterable"]`, paths for `@/*` and `@matinee/*`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\tsconfig.json`
      Verify: `pnpm --filter @matinee/web typecheck` runs (errors expected until src/ exists).

- [ ] 16. Create apps/web/index.html with proper meta tags.
      HTML5 doctype, UTF-8, viewport `width=device-width, initial-scale=1.0`, title "Matinee".
      Meta: `playsinline` noted in comments for video elements, PWA-ready placeholders (manifest link, theme-color).
      Script tag: `<script type="module" src="/src/main.tsx"></script>`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\index.html`
      Verify: File is valid HTML5 — parse with vite dev server (next step).

- [ ] 17. Create apps/web/src directory structure and entry point.
      Folders: `src/pages/`, `src/components/`, `src/stores/`, `src/lib/`, `src/styles/`.
      Create `src/main.tsx`: React 18 `createRoot`, imports `App` from `./App.tsx`, imports `./styles/global.css`.
      Create `src/App.tsx`: placeholder React component with react-router-dom `BrowserRouter` and a single route `/` rendering `<h1>Matinee</h1>`.
      Create `src/styles/global.css`: import `@matinee/ui-tokens/dist/tokens.css`, set `body` styles using CSS custom properties.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\main.tsx`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\App.tsx`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\styles\global.css`
      Verify: `pnpm --filter @matinee/web dev` — dev server starts on http://localhost:5173, page renders "Matinee" heading.

- [ ] 18. Create apps/web Zustand stores (empty shells).
      Create `src/stores/room.ts`: `export const useRoomStore = create(() => ({ roomId: null as string | null }));`.
      Create `src/stores/user-prefs.ts`: `export const useUserPrefsStore = create(() => ({ language: 'en' as const }));`.
      Create `src/stores/subtitle.ts`: `export const useSubtitleStore = create(() => ({ tracks: [] as any[] }));`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\stores\room.ts`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\stores\user-prefs.ts`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\stores\subtitle.ts`
      Verify: TypeScript compiles without errors — `pnpm --filter @matinee/web typecheck`.

- [ ] 19. Create apps/web i18next configuration with EN, TH, ML locales.
      Create `src/lib/i18n.ts`: initialize i18next with `react-i18next`, lng `'en'`, fallbackLng `'en'`, resources with namespaces for `en`, `th`, `ml`.
      Create placeholder translation files: `src/locales/en/common.json` (`{ "app_name": "Matinee" }`), `src/locales/th/common.json` (`{ "app_name": "มาตีเน่" }`), `src/locales/ml/common.json` (`{ "app_name": "മാറ്റിനി" }`).
      Import i18n setup in `main.tsx` before rendering.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\lib\i18n.ts`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\locales\en\common.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\locales\th\common.json`, `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\locales\ml\common.json`
      Verify: Dev server still runs; `useTranslation()` hook works in a test component.

- [ ] 20. Create apps/web placeholder page components.
      Create `src/pages/Foyer.tsx`: `export default function Foyer() { return <h1>Foyer</h1>; }`.
      Create `src/pages/Theatre.tsx`: `export default function Theatre() { return <h1>Theatre</h1>; }`.
      Create `src/pages/About.tsx`: `export default function About() { return <h1>About</h1>; }`.
      Create `src/pages/NotFound.tsx`: `export default function NotFound() { return <h1>404</h1>; }`.
      Wire routes in `App.tsx` using react-router-dom: `/` → Foyer, `/theatre/:roomId` → Theatre, `/about` → About, `*` → NotFound.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\pages\Foyer.tsx`, `Theatre.tsx`, `About.tsx`, `NotFound.tsx`, update `App.tsx`
      Verify: Navigate to http://localhost:5173/, http://localhost:5173/about, http://localhost:5173/xyz — all routes render correctly.

- [ ] 21. Create apps/web capability detection utility.
      Create `src/lib/capabilities.ts`: export `detectCapabilities()` function returning object with boolean flags for `webrtc`, `webgpu`, `wakeLock`, `fileSystemAccess`, `requestVideoFrameCallback`, `captureStream`, `getDisplayMedia`.
      Use feature detection (check `navigator.mediaDevices`, `navigator.gpu`, `navigator.wakeLock`, `window.showOpenFilePicker`, `HTMLVideoElement.prototype.requestVideoFrameCallback`, `HTMLMediaElement.prototype.captureStream`, `navigator.mediaDevices.getDisplayMedia`).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\lib\capabilities.ts`
      Verify: Import and call in a component; console logs capability object with correct browser flags.

---

## PHASE 4 — Edge Worker and Durable Objects

- [ ] 22. Create apps/edge with Cloudflare Worker scaffolding.
      Package.json: name `@matinee/edge`, version `0.0.0`, type `module`, private `true`.
      Dependencies: `@matinee/protocol: workspace:*`.
      DevDependencies: `typescript@5.9.3`, `wrangler@^4.9.0`, `@cloudflare/workers-types@^4.20260103.0`.
      Scripts: `dev` (`wrangler dev`), `deploy` (`wrangler deploy`), `typecheck` (`tsc --noEmit`).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\edge\package.json`
      Verify: `pnpm install` at root; wrangler available.

- [ ] 23. Create apps/edge wrangler.toml for Workers Assets and Durable Objects.
      name = `"matinee-edge"`, main = `"src/index.ts"`, compatibility_date = `"2026-10-08"`.
      [assets]: `directory = "../../apps/web/dist"`, `binding = "ASSETS"`.
      [[durable_objects.bindings]]: `name = "ROOM_DO"`, `class_name = "RoomDO"`, `script_name = "matinee-edge"`.
      [[migrations]]: `tag = "v1"`, `new_classes = ["RoomDO"]`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\edge\wrangler.toml`
      Verify: File parses — `pnpm --filter @matinee/edge wrangler dev --dry-run` validates config.

- [ ] 24. Create apps/edge tsconfig.json with Cloudflare Workers types.
      Extends `../../tsconfig.json`, types: `["@cloudflare/workers-types"]`, lib: `["ESNext"]`, module: `"ESNext"`, target: `"ES2022"`.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\edge\tsconfig.json`
      Verify: TypeScript recognizes Cloudflare types — `pnpm --filter @matinee/edge typecheck` (after next step).

- [ ] 25. Create apps/edge/src/index.ts Worker entry point with route handlers.
      Export default object with `fetch(request, env, ctx)` handler.
      Route stubs (return JSON responses):
        - `POST /api/rooms` → `{ roomId: 'stub', created: true }`
        - `GET /api/ice` → `{ iceServers: [] }`
        - `GET /ws/:roomId` → WebSocket upgrade placeholder returning 501 Not Implemented
        - All other routes → `env.ASSETS.fetch(request)` (serve static assets)
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\edge\src\index.ts`
      Verify: `pnpm --filter @matinee/edge typecheck` — compiles without errors.

- [ ] 26. Create apps/edge/src/room-do.ts RoomDO class with Hibernation API stubs.
      Export `RoomDO` class implementing DurableObject.
      Constructor takes `state: DurableObjectState`, `env: Env`.
      Methods: `fetch(request)` handling WebSocket upgrade, returning 200 with "RoomDO initialized".
      Stub methods: `webSocketMessage()`, `webSocketClose()`, `webSocketError()` (hibernation callbacks, log only).
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\edge\src\room-do.ts`
      Verify: TypeScript compiles — `pnpm --filter @matinee/edge typecheck`.

- [ ] 27. Wire RoomDO export in apps/edge/src/index.ts.
      Add `export { RoomDO } from './room-do.js';` at bottom of index.ts.
      Update `/ws/:roomId` route to get DO stub from `env.ROOM_DO.get(id)` and forward `request` to `stub.fetch(request)`.
      Files: Update `d:\Portfolio_Projects\testantigravity\MATINEE\apps\edge\src\index.ts`
      Verify: `pnpm --filter @matinee/edge dev` — wrangler dev starts without errors; hitting http://localhost:8787/api/rooms returns stub JSON.

---

## PHASE 5 — Integration and Verification

- [ ] 28. Update root package.json scripts to use workspace filters.
      Update `dev` script to: `"turbo run dev --filter=@matinee/web --filter=@matinee/edge"`.
      Update `build` script to run turbo build across all packages.
      Add `install` hook: `"preinstall": "npx only-allow pnpm"` to enforce pnpm usage.
      Files: Update `d:\Portfolio_Projects\testantigravity\MATINEE\package.json`
      Verify: `pnpm dev` starts both web and edge dev servers concurrently.

- [ ] 29. Add TypeScript project references across packages.
      Update root tsconfig.json with `references` array pointing to all packages and apps.
      Each package/app tsconfig.json already has `composite: true` (set in earlier steps).
      Files: Update `d:\Portfolio_Projects\testantigravity\MATINEE\tsconfig.json`, verify all package tsconfigs have `composite: true` and `references` arrays pointing to their dependencies.
      Verify: `pnpm typecheck` at root runs TypeScript project references build — all packages compile in dependency order.

- [ ] 30. Verify complete monorepo builds from clean slate.
      Clean all artifacts: `pnpm turbo clean` (or manually delete all `dist/`, `node_modules/.cache/`, `.turbo/`).
      Reinstall: `rm -rf node_modules && pnpm install`.
      Build all: `pnpm turbo run build`.
      Check outputs: every package has `dist/` with `.js` and `.d.ts` files; `apps/web/dist/` has `index.html` and bundled assets.
      Files: N/A (verification step)
      Verify: All builds succeed; `pnpm --filter @matinee/web dev` starts web app on :5173; `pnpm --filter @matinee/edge dev` starts worker on :8787; opening http://localhost:5173 renders "Matinee" and routes work.

- [ ] 31. Create apps/web smoke test that imports all workspace packages.
      Create `src/lib/__smoke-test__.ts`: import all five packages (`@matinee/protocol`, `@matinee/sync-engine`, `@matinee/subtitle-core`, `@matinee/subtitle-pipeline`, `@matinee/ui-tokens`) and log a success message.
      Call this in `main.tsx` wrapped in `if (import.meta.env.DEV)` block.
      Files: `d:\Portfolio_Projects\testantigravity\MATINEE\apps\web\src\lib\__smoke-test__.ts`, update `main.tsx`
      Verify: Dev server starts; browser console shows smoke test success message; no import errors.

- [ ] 32. Document the scaffolded structure in root README.md.
      Add "Project Structure" section listing all packages and apps with one-line descriptions.
      Add "Verification Checklist" section: lists commands to verify setup (`pnpm install`, `pnpm build`, `pnpm dev`).
      Add "Next Steps" section: links to docs/DECISIONS.md, docs/RESEARCH.md.
      Files: Update `d:\Portfolio_Projects\testantigravity\MATINEE\README.md`
      Verify: README renders correctly; all links resolve.

---

## Final State Checklist

After completing all 32 steps, verify:

1. ✅ `pnpm install` at root succeeds with no errors or warnings
2. ✅ `pnpm turbo run build` compiles all packages and apps
3. ✅ `pnpm turbo run typecheck` passes with zero TypeScript errors
4. ✅ `pnpm --filter @matinee/web dev` starts Vite dev server on http://localhost:5173
5. ✅ Web app renders "Matinee" heading; routes (/, /about, /theatre/test, /xyz) all work
6. ✅ Browser console shows successful imports of all workspace packages
7. ✅ `pnpm --filter @matinee/edge dev` starts wrangler dev server on http://localhost:8787
8. ✅ Hitting http://localhost:8787/api/rooms returns JSON stub `{ "roomId": "stub", "created": true }`
9. ✅ All package `dist/` directories contain `.js` and `.d.ts` files
10. ✅ No feature logic implemented — only structure and wiring

---

## Key Dependency Versions (Locked)

- Node: `20.18.1` (LTS)
- pnpm: `10.33.3`
- TypeScript: `5.9.3`
- React: `^18.3.1`
- Vite: `^6.1.5`
- wrangler: `^4.9.0`
- @huggingface/transformers: `^4.3.1` (not installed yet; reserved for subtitle-pipeline implementation)
- zustand: `^5.0.3`
- i18next: `^24.3.2`
- react-router-dom: `^7.5.1`
- turbo: `^2.3.3`

---

## Notes for Implementer

- Every path must be absolute (Windows): `d:\Portfolio_Projects\testantigravity\MATINEE\...`
- Use `pnpm` exclusively (enforced by preinstall hook)
- Package imports use workspace protocol: `"@matinee/protocol": "workspace:*"`
- TypeScript `composite: true` + `references` enables incremental builds
- Vite path aliases map `@/` to `src/`, `@matinee/*` to workspace packages
- Wrangler.toml `assets.directory` points to `../../apps/web/dist` (relative from apps/edge/)
- CSS custom properties from `@matinee/ui-tokens` are imported in `apps/web/src/styles/global.css`
- i18next initialization happens in `src/lib/i18n.ts` and is imported in `main.tsx` before `createRoot`
- All placeholders are minimal but functional — they compile, run, and can be imported
- RoomDO hibernation methods are stubs (no implementation, just log statements)
- No ML models, no WebRTC negotiation, no E2EE, no subtitle parsing — only types and interfaces

**Constraint adherence:**
- ✅ Windows paths (absolute)
- ✅ pnpm workspaces
- ✅ TypeScript strict mode
- ✅ Node 20 LTS
- ✅ Every package has hello-world export
- ✅ `pnpm install` succeeds after scaffolding
- ✅ TypeScript compiles across all packages
- ✅ `pnpm --filter @matinee/web dev` starts Vite
- ✅ `pnpm --filter @matinee/edge dev` runs wrangler dev

