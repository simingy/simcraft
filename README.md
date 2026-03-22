# SimHammer

SimulationCraft made simple. Run sims from your browser or download the desktop app.

**[simhammer.com](https://simhammer.com)** · **[Download Desktop App](https://github.com/sortbek/simcraft/releases/latest)**

## Features

- **Quick Sim** — Paste your SimC addon string, get DPS and ability breakdown
- **Top Gear** — Find the best gear combination from your bags, bank, and vault
- **Drop Finder** — Find the best dungeon/raid drops for your character
- **Stat Weights** — See which stats matter most for your character
- **Desktop App** — Run everything locally with all your CPU cores, no server needed

## Prerequisites

- **Docker** — required for both web deployment and desktop development
- **Node.js** 20+ and **Rust** — additionally required for desktop development

## Project Structure

```
frontend/          Next.js 14 app (shared by web + desktop)
backend/           Cargo workspace (Rust)
  core/            simhammer-core library (API routes, simc runner, game data)
  server/          simhammer-server binary (--desktop flag for desktop mode)
  resources/       Runtime resources (data/, simc/, frontend/) — gitignored
desktop/           Electron app (main process, preload, build scripts)
docker-compose.yml Web deployment + desktop resource provisioning
```

## Web

### Quick Start

```bash
git clone https://github.com/sortbek/simcraft.git
cd simcraft
docker compose -f docker-compose.dev.yml up --build
```

Docker handles everything automatically — compiles the Rust backend, builds SimC from source, fetches game data from Raidbots, and builds the Next.js frontend.

- Frontend: http://localhost:3000
- API: http://localhost:8000

### Deploy to a VPS

1. Clone the repo on your server
2. Run `docker compose up -d --build`
3. Set up nginx as reverse proxy (port 80 → 3000 for frontend, /api/ → 8000 for backend)

## Desktop

### Download

Grab the latest installer from [GitHub Releases](https://github.com/sortbek/simcraft/releases/latest).

### Development

#### 1. Install dependencies

```bash
cd frontend && npm install && cd ..
cd desktop && npm install && cd ..
```

#### 2. Run

```bash
npm run desktop:dev
```

On first run, this automatically uses Docker to fetch game data from Raidbots and compile SimulationCraft from source (stored in `backend/resources/`). On subsequent runs, this step is skipped since the resources already exist.

After resources are ready, it:
1. Builds the Rust backend in debug mode
2. Starts the Next.js dev server on port 3000
3. Launches the Electron app

To re-fetch resources (e.g. after a game patch), delete `backend/resources/data/` and/or `backend/resources/simc/` and run `npm run desktop:dev` again.

### Build installer

```bash
npm run desktop:build
```

Builds the frontend (static export), compiles the Rust backend in release mode, copies all resources, and packages everything into an installer with electron-builder.

Output goes to `desktop/dist/`.

| Platform | Target |
|----------|--------|
| Windows  | NSIS installer |
| macOS    | DMG |
| Linux    | AppImage, deb |

## Getting a SimC Addon String

1. Install the [SimulationCraft addon](https://www.curseforge.com/wow/addons/simulationcraft) in WoW
2. In-game, type `/simc`
3. Copy the full text from the popup window
4. Paste it into SimHammer

## Architecture

### Web
```
Browser → Next.js (3000) → Rust/Actix-web (8000) → SQLite → simc subprocess
```

### Desktop
```
Electron → Next.js → Rust/Actix-web (17384) → MemoryStorage → simc subprocess
```

Both use the same Next.js frontend and the same Rust core library (`simhammer-core`). The core provides API routes, addon parsing, profileset generation, and simc process management. Storage is abstracted via a `JobStorage` trait — the web server uses `SqliteStorage`, the desktop app uses `MemoryStorage`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMC_PATH` | `/usr/local/bin/simc` | Path to SimulationCraft binary |
| `DATA_DIR` | `./resources/data` | Path to game data JSON files |
| `DATABASE_URL` | `simhammer.db` | SQLite database path (web only) |
| `PORT` | `8000` | Server port |
| `BIND_HOST` | `0.0.0.0` | Server bind address |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API URL (frontend) |
