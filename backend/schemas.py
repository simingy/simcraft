from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from config import settings


class FightStyle(str, Enum):
    PATCHWERK = "Patchwerk"
    HECTIC_ADD_CLEAVE = "HecticAddCleave"
    LIGHT_MOVEMENT = "LightMovement"


class SimType(str, Enum):
    QUICK = "quick"
    STAT_WEIGHTS = "stat_weights"
    TOP_GEAR = "top_gear"


class SimRequest(BaseModel):
    simc_input: str = Field(..., min_length=10)
    iterations: int = Field(
        default=settings.DEFAULT_ITERATIONS,
        ge=100,
        le=settings.MAX_ITERATIONS,
    )
    fight_style: FightStyle = FightStyle.PATCHWERK
    target_error: float = Field(default=0.1, ge=0.1, le=1.0)
    sim_type: SimType = SimType.QUICK


class SimResponse(BaseModel):
    id: str
    status: str
    created_at: datetime


class TopGearRequest(BaseModel):
    simc_input: str = Field(..., min_length=10)
    selected_items: dict[str, list[int]]
    iterations: int = Field(
        default=settings.DEFAULT_ITERATIONS,
        ge=100,
        le=settings.MAX_ITERATIONS,
    )
    fight_style: FightStyle = FightStyle.PATCHWERK
    target_error: float = Field(default=0.1, ge=0.1, le=1.0)


class ItemInfoRequest(BaseModel):
    items: list[dict[str, Any]] = Field(default_factory=list)
    item_ids: list[int] = Field(default_factory=list)


class JobStatusResponse(BaseModel):
    id: str
    status: str
    progress: int = 0
    result: dict[str, Any] | None = None
    error: str | None = None
