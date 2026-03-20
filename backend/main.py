import logging
from contextlib import asynccontextmanager

from arq import create_pool
from arq.connections import RedisSettings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers import health, items, sim
from services import game_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")
    game_data.load()
    await init_db(drop_all=settings.DROP_DB_ON_STARTUP)
    logger.info("Database initialized")

    # Shared Redis pool
    app.state.redis = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    logger.info("Redis connection OK")

    yield

    await app.state.redis.close()
    logger.info("Shutting down...")


app = FastAPI(title="SimHammer", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sim.router)
app.include_router(items.router)
