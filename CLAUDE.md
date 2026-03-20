# SimHammer

Self-hosted SimulationCraft web app.

## Architecture
- **Backend**: Python 3.11 + FastAPI (port 8000)
- **Worker**: ARQ (async Redis queue) processes simc jobs
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind (port 3000)
- **Database**: SQLite via async SQLAlchemy
- **Queue**: Redis

## Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Worker
```bash
cd backend
python -m arq worker.tasks.WorkerSettings
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Docker
```bash
docker compose up
```

## Key Patterns
- All DB access is async (aiosqlite)
- API errors return `{"detail": "..."}`
- Frontend polls `/api/sim/{id}` every 2s for job status
- simc runs as subprocess, writes JSON output, which is parsed by result_parser.py
- Gold accent color: `#C8992A`
