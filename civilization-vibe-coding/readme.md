# About this project
This is an attempt to build civilization game like using AI agent 99%. Currently using openai codex-cli, checkout build_prompts.md where all the prompts were documented

There were very few code tweaks, in particular data objects for resources, accidents, terrains, units which are not documented.

# Civ Game
A customizable Civilization-like turn-based strategy game built with React, TypeScript, Vite, and Zustand.

## Features

- Modular configuration for terrains, units, and technologies
- Performant virtualized HTML table map (~1600×1000 grid)
- Layered rendering of multiple items (terrain, cities, units) per cell
- Turn-based gameplay skeleton
- Zoom controls for map (zoom in/out with adjustable cell size)
- Map size controls for adjustable map width and height

## Getting Started

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Build for production

```bash
npm run build
```

## Customization

Customize terrains, units, and technologies in `src/config/*.ts`. Adjust default zoom (cellSize) and zoom behavior in `src/store/useGameStore.ts`. Map width and height can now be configured via the Controls UI.