# DECISIONS.md — Architecture Decision Index
> Each entry is a short summary. The full ADR lives in docs/adr/.
> Status: Proposed | Decided | Superseded.

| ID | Title | Status | Date |
|----|-------|--------|------|
| ADR-0001 | Use Cloudflare Worker (single deployment) for both static assets and /api/* routes | Decided | 2026-10-08 |
| ADR-0002 | Use WebSocket Hibernation API for RoomDO; persist all state to SQLite or serializeAttachment | Decided | 2026-10-08 |
| ADR-0003 | Use Cloudflare Workers Assets binding instead of Cloudflare Pages | Decided | 2026-10-08 |
| ADR-0004 | Use single-threaded ffmpeg.wasm (no SharedArrayBuffer / no COEP) | Decided | 2026-10-08 |
| ADR-0005 | Primary TURN: Cloudflare Realtime (card required); fallback: Metered open-relay | Decided | 2026-10-08 |
| ADR-0006 | In-browser Whisper via @huggingface/transformers v4; WebGPU primary, WASM fallback | Decided | 2026-10-08 |
| ADR-0007 | Translation ladder: Gemini BYOK > CF Workers AI > NLLB-200 local > MyMemory | Proposed | 2026-10-08 |
| ADR-0008 | Use P-256 for ephemeral ECDH (not X25519) for broadest Safari compatibility | Decided | 2026-10-08 |
| ADR-0009 | pnpm workspaces monorepo; TypeScript strict; Vite + React 18; Zustand; i18next | Decided | 2026-10-08 |
| ADR-0010 | NLLB-200 (CC-BY-NC) approved for private personal use; documented in LICENSES.md | Decided | 2026-10-08 |
