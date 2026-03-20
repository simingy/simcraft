# SimHammer

Self-hosted [SimulationCraft](https://github.com/simulationcraft/simc) web app. Paste your SimC addon string, configure options, and get DPS results with ability breakdowns, stat weights, and Top Gear comparisons.

## Quick Start (Docker)

```bash
git clone <repo-url> simhammer
cd simhammer
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

The Docker build compiles `simc` from source (takes a few minutes on first build).

## Deploy to a VPS

1. Clone the repo on your server
2. Create `.env` from the example and set `SERVER_IP` to your domain or IP:

```bash
cp .env.example .env
nano .env
# Set SERVER_IP=simhammer.com
```

3. Start the stack:

```bash
docker compose up -d --build
```

## Local Dev (without Docker)

### Prerequisites
- Python 3.11+
- Node.js 20+
- Redis
- SimulationCraft binary (`simc`) — [download](https://github.com/simulationcraft/simc/releases) or build from source

### 1. Start Redis
```bash
redis-server
```

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Worker
```bash
cd backend
source venv/bin/activate
python -m arq worker.tasks.WorkerSettings
```

### 4. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 5. SimulationCraft Binary
Set the `SIMC_PATH` environment variable to your `simc` binary:
```bash
export SIMC_PATH=/path/to/simc
```

## Getting a SimC Addon String

1. Install the [SimulationCraft addon](https://www.curseforge.com/wow/addons/simulationcraft) in WoW
2. In-game, type `/simc`
3. Copy the full text from the popup window
4. Paste it into the input box

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `SIMC_PATH` | `/usr/local/bin/simc` | Path to simc binary |
| `SIMC_THREADS` | `4` | Threads per simc process |
| `SIMC_TIMEOUT` | `300` | Max seconds per simulation |
| `DATABASE_URL` | `sqlite+aiosqlite:///./simhammer.db` | Database connection string |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |
| `MAX_ITERATIONS` | `10000` | Maximum allowed iterations |
| `DEFAULT_ITERATIONS` | `1000` | Default iteration count |
| `DROP_DB_ON_STARTUP` | `false` | Wipe DB on boot (useful for dev) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | API URL for the frontend |
| `SERVER_IP` | `localhost` | Server IP/domain used in docker-compose |

## Scaling Workers

```bash
# Docker
docker compose up --scale worker=4

# Manual — run in multiple terminals
python -m arq worker.tasks.WorkerSettings
```

## Architecture

```
Browser → Next.js (3000) → FastAPI (8000) → Redis Queue → ARQ Worker → simc subprocess
                                                ↓
                                            SQLite DB
```
