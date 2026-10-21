# 🎬 Matinee

**Watch movies together, miles apart.** A real-time movie streaming app for long-distance couples with end-to-end encrypted chat, WebRTC video, and synchronized playback.

![Matinee](https://img.shields.io/badge/WebRTC-Streaming-E7C98E?style=for-the-badge)
![E2EE](https://img.shields.io/badge/E2EE-Messages-E07A8F?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-08070B?style=for-the-badge)

---

## ✨ Features

### 🎥 Real-Time Streaming
- **Film or TV**: Stream video files with quality presets (Auto/High/Medium/Low)
- **Screen Share**: Share your entire screen or specific window
- **Face Bubbles**: Draggable video chat overlays (S/M/L, circle/square)
- **Synchronized Playback**: Play/pause/seek controls sync across users

### 🔐 Privacy First
- **End-to-End Encryption**: Messages encrypted with Session protocol
- **No Account Required**: Instant rooms with secure invite links
- **Peer-to-Peer Video**: Direct WebRTC connections (no server recording)

### 🎛️ Rich Controls
- **Volume Control**: 0-100% slider
- **Quality Presets**: Auto, High (1080p), Medium (720p), Low (480p)
- **Fullscreen**: Immersive viewing mode
- **Keyboard Shortcuts**:
  - `Space` — Play/Pause
  - `F` — Fullscreen
  - `M` — Mute/Unmute
  - `←` `→` — Seek ±10s

### 💬 Built-In Chat
- Real-time messaging with E2EE
- No message history stored on server
- Presence indicators (You/Partner)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ and **pnpm** 9+
- **Modern browser** (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/matinee.git
cd matinee

# Install dependencies
pnpm install

# Start development servers
pnpm run dev
```

This starts:
- **Web app**: http://localhost:5173
- **Edge server**: http://localhost:8788

### Usage

1. Open http://localhost:5173
2. Click **"New room"**
3. Copy the invite link
4. Share with your partner (WhatsApp, Signal, etc.)
5. Partner clicks link and joins
6. Start streaming! 🎬

---

## 📦 Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   User (India)  │◄──────► │ User (Thailand) │
│                 │  WebRTC │                 │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │        WebSocket          │
         │      (Signaling)          │
         └────────┬──────────────────┘
                  │
         ┌────────▼────────┐
         │  Edge Server    │
         │  (Cloudflare)   │
         │  Durable Object │
         └─────────────────┘
```

- **Web App** (`apps/web`): React + TypeScript + Vite
- **Edge Server** (`apps/edge`): Cloudflare Workers + Durable Objects
- **Protocol** (`packages/protocol`): E2EE Session protocol + WebRTC utilities
- **Packages**: Shared libraries (subtitle-core, sync-engine, ui-tokens)

---

## 🏗️ Project Structure

```
matinee/
├── apps/
│   ├── edge/          # Cloudflare Workers + Durable Objects
│   │   ├── src/
│   │   │   ├── index.ts        # Worker entry point
│   │   │   └── room-do.ts      # Room state + WebSocket handling
│   │   └── wrangler.toml       # Cloudflare config
│   └── web/           # React SPA
│       ├── src/
│       │   ├── pages/          # RoomPage, FoyerPage
│       │   ├── components/     # SourcePanel, ViewerPanel, FaceBubble
│       │   ├── lib/            # RoomClient, WebRTCClient, hooks
│       │   └── styles/         # app.css (dark romantic theme)
│       ├── vite.config.ts
│       └── vercel.json         # Vercel deployment config
├── packages/
│   ├── protocol/      # E2EE Session + utilities
│   ├── subtitle-core/ # SRT parsing/rendering
│   ├── sync-engine/   # Playback synchronization
│   └── ui-tokens/     # Design tokens
├── docs/              # Architecture Decision Records (ADR)
├── e2e/               # Playwright end-to-end tests
├── tools/             # Development utilities
├── DEPLOY.md          # Production deployment guide
└── README.md          # This file
```

---

## 🧪 Testing

### Unit Tests

```bash
# Protocol package tests
cd packages/protocol
pnpm test

# Watch mode
pnpm test:watch
```

### E2E Tests

```bash
# Install Playwright browsers (first time only)
pnpm playwright install --with-deps chromium

# Run E2E tests
cd e2e
pnpm test

# With UI
pnpm test:ui
```

Tests cover:
- Room creation and joining
- Connection state (alone → together)
- StrictMode double-render handling
- WebRTC signaling flow

---

## 📚 Documentation

- **[DEPLOY.md](DEPLOY.md)**: Production deployment to Vercel + Cloudflare
- **[docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md)**: Design assumptions and constraints
- **[docs/DECISIONS.md](docs/DECISIONS.md)**: Key technical decisions
- **[docs/RISKS.md](docs/RISKS.md)**: Known limitations and mitigation strategies
- **[docs/adr/](docs/adr/)**: Architecture Decision Records

---

## 🎨 Design Philosophy

### Romantic & Intimate
- **Dark theme**: #08070B background, #E7C98E gold accents, #E07A8F rose highlights
- **Minimal UI**: Focus on content, not controls
- **Soft animations**: Fade-ins, smooth transitions

### Privacy-Focused
- **No tracking**: Zero analytics, no cookies
- **No accounts**: Anonymous rooms, no email required
- **Ephemeral**: Rooms close when users leave

### Long-Distance Optimized
- **Low latency**: STUN servers (Cloudflare + Google)
- **Quality presets**: Adapt to India-Thailand bandwidth
- **Presence indicators**: Know when your partner is there

---

## 🚧 Roadmap

### In Progress
- ✅ Core streaming (film + screen share)
- ✅ E2EE chat
- ✅ Face bubbles (draggable, S/M/L)
- ✅ Keyboard shortcuts
- ✅ Settings panel (volume, quality)
- ✅ Fullscreen support

### Next
- [ ] **TURN Server**: Relay fallback for restrictive NATs
- [ ] **Subtitle Support**: Upload .srt files, synchronized rendering
- [ ] **Watch History**: LocalStorage-only, no server storage
- [ ] **Mobile PWA**: Install as app, offline support
- [ ] **Screen Recording**: Save your watch sessions locally

### Future
- [ ] **Multiple Rooms**: Support 3+ users per room
- [ ] **Voice Chat**: Audio-only mode for low bandwidth
- [ ] **Co-browsing**: Synchronized web browsing
- [ ] **Games**: Tic-tac-toe, trivia during movie breaks

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'feat: add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- **TypeScript**: Strict mode, no `any`
- **Tests**: Unit tests for protocol, E2E for user flows
- **Commits**: Conventional Commits (feat, fix, docs, chore)
- **Architecture**: Record decisions in `docs/adr/`

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **WebRTC**: Peer-to-peer video streaming
- **Cloudflare Workers**: Edge server infrastructure
- **Vercel**: Web app hosting
- **Session Protocol**: E2EE messaging inspiration

---

## 💌 Built For

Long-distance couples who want to feel close, even when they're continents apart.

**India 🇮🇳 ↔ Thailand 🇹🇭**

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/matinee/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/matinee/discussions)
- **Email**: support@matinee.app (coming soon)

---

**Made with ❤️ for watching together, wherever you are.**
