# Live Agents

A Cursor companion that visualizes agents and subagents as named vinyl workers in a living 3D office — like a little game for watching your swarm. No API key required for mirror mode.

**Live demo:** [csherman-lab.github.io/live-agents](https://csherman-lab.github.io/live-agents/)

## Features

- **Cursor Mirror (default)** — One character per Cursor agent/subagent; thinking / working / done drive the office
- **Named workers** — Nameplates + status bubbles; click to customize name, color, accessory
- **Mock Swarm** — Preview the office without Cursor
- **Game lobby** — Empty office waits for Cursor; Enter Office with zero keys
- **Advanced (optional)** — Legacy Teams designer + BYOK Gemini / OpenAI / Anthropic runner

## Getting Started (≤5 minutes)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in **Chrome or Safari** (WebGPU).

1. **Enter Office** (or dismiss the tip)
2. Click **Mock Swarm** — four named workers (no Cursor required)
3. **Optional live:** keep the app running; use this repo’s project hooks or `npm run bridge:install` for any workspace

The hosted [github.io demo](https://csherman-lab.github.io/live-agents/) is **Mock Swarm only** — no local presence hub or Cursor hooks on static hosting.

### Cursor hooks

- **This repo:** project `.cursor/hooks.json` → `http://127.0.0.1:3000/api/presence`
- **Any workspace:** `npm run bridge:install`
- **Escape hatch:** `LIVE_AGENTS_PRESENCE_URL=http://127.0.0.1:3000/api/presence`
- **Verify:** `npm run bridge:smoke` and `window.__laPresenceHub()` in DevTools

Details: [`tools/cursor-bridge/README.md`](tools/cursor-bridge/README.md).

## Advanced (optional)

### API keys

Only needed for the legacy in-app agent runner under **Advanced**.

| Provider | Key URL | Capabilities |
|----------|---------|--------------|
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Text, image, music, video |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Text only |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Text only |

Copy `.env.example` to `.env` for optional local dev variables (never commit real keys).

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `G` | Enter Office / enter workspace |
| `S` | Open Settings |
| `?` | Show all shortcuts |

## Scripts

```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # TypeScript check
npm run test         # Unit tests (Vitest)
npm run test:e2e     # Smoke tests (Playwright)
npm run check        # lint + test + build
npm run assets:generate  # Rebuild 3D models (requires Blender)
```

## Tech Stack

- React 19 + TypeScript + Vite
- Three.js (WebGPU) for 3D simulation
- React Flow for team visualization (Advanced)
- Zustand for state management
- Cursor hooks → local presence hub for mirror mode
- Optional Gemini / OpenAI / Anthropic for Advanced runner

## 3D assets

See `scripts/blender/` and the perfection goal under `docs/assets/`.
