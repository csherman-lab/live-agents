# Live Agents

A beautiful workspace to design, configure, and watch your AI agents collaborate — in chat, in tasks, or in a living 3D office when WebGPU is available.

**Live demo:** [csherman-lab.github.io/live-agents](https://csherman-lab.github.io/live-agents/)

## Features

- **Command Center** — Write a brief, pick templates, chat with your lead agent, and preview the workspace
- **Text-first workflow** — Run agents without 3D; WebGPU is optional for the immersive office
- **Go Live** — Enter a 3D office where agents walk, sit, work, and collaborate (Chrome, Edge, Safari 18+)
- **Multi-provider AI** — Bring your own key for **Google Gemini**, **OpenAI**, or **Anthropic Claude** (stored locally)
- **Team Designer** — Visual node-based editor to create multi-agent teams
- **Provider warnings** — Alerts when your team output type (image/music/video) doesn't match your provider
- **Export** — Deliverables, HTML report, and full project bundle JSON

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### API keys

| Provider | Key URL | Capabilities |
|----------|---------|--------------|
| Google Gemini | [aistudio.google.com](https://aistudio.google.com/app/apikey) | Text, image, music, video |
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | Text only |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Text only |

Use **Explore demo** to browse the UI without a key. Agents only run after you add a key. For image/music/video teams, use Gemini.

Copy `.env.example` to `.env` for optional local dev variables (never commit real keys).

## Demo guide (showing others)

1. Open the [live demo](https://csherman-lab.github.io/live-agents/) in **Chrome or Safari** (not an embedded IDE browser).
2. Skip the intro, open **Settings**, and paste a [Gemini API key](https://aistudio.google.com/app/apikey) (easiest full demo) or OpenAI/Anthropic for text-only teams.
3. Pick a **Text** output team (e.g. Creative Agency) in **Teams** if using OpenAI or Anthropic.
4. Write a short brief in the Command Center, then **Go Live**.

**What to tell viewers**

- **Explore demo** = UI walkthrough only; agents need an API key to actually run.
- **3D office** needs WebGPU (Chrome, Edge, Safari 18+). Overview chat and planning work without 3D.
- Keys stay in the browser — nothing is sent to our servers.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `G` | Go Live / enter workspace |
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
- React Flow for team visualization
- Zustand for state management
- Gemini / OpenAI / Anthropic APIs for agent intelligence

## 3D assets

Original MIT-licensed workspace and character models in `public/models/`. See `docs/assets/art-direction.md` and `docs/assets/3d-asset-spec.md`. Regenerate with `npm run assets:generate` (Blender required).

## License

MIT — see `LICENSE`.
