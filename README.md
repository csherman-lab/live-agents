# Live Agents

A beautiful 3D workspace to design, configure, and watch your AI agents collaborate in real time.

## Features

- **Command Center** — Write a brief, pick templates, and preview your agent workspace before going live
- **Go Live** — Enter an immersive 3D office where agents walk, sit, work, and collaborate
- **Team Designer** — Visual node-based editor to create multi-agent teams
- **Gemini API** — Bring your own key (stored locally in your browser); demo mode lets you explore without one
- **Live Preview** — Watch agents move in a live preview box from the overview
- **Approval inbox** — See tasks waiting for your input from the command center

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

You'll need a [Gemini API key](https://aistudio.google.com/app/apikey) to run agent simulations. Use **Explore demo** to browse the workspace without a key.

## Tech Stack

- React 19 + TypeScript + Vite
- Three.js (WebGPU) for 3D simulation
- React Flow for team visualization
- Zustand for state management
- Google Gemini API for agent intelligence

## License

MIT
