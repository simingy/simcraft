"""Proxy endpoint for fetching WoW item info (name, quality, icon, ilevel) from Wowhead.

Results are persisted to SQLite so they survive restarts.
Bonus IDs are passed to Wowhead so the correct quality is returned
(e.g. an item upgraded to Hero track shows as Epic, not Rare).
"""

import logging
import re
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import ItemCache
from schemas import ItemInfoRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["items"])

QUALITY_NAMES = {
    0: "poor",
    1: "common",
    2: "uncommon",
    3: "rare",
    4: "epic",
    5: "legendary",
    6: "artifact",
    7: "heirloom",
}

WOWHEAD_TOOLTIP_URL = "https://nether.wowhead.com/tooltip/item/{item_id}"
WOWHEAD_SPELL_URL = "https://nether.wowhead.com/tooltip/spell/{spell_id}"


def _normalize_bonus(bonus_ids: list[int] | None) -> str:
    if not bonus_ids:
        return ""
    return ":".join(str(b) for b in sorted(bonus_ids))


def _row_to_dict(row: ItemCache) -> dict[str, Any]:
    return {
        "item_id": row.item_id,
        "name": row.name,
        "quality": row.quality,
        "quality_name": QUALITY_NAMES.get(row.quality, "common"),
        "icon": row.icon,
        "ilevel": row.ilevel,
    }


def _fallback(item_id: int) -> dict[str, Any]:
    return {
        "item_id": item_id,
        "name": f"Item {item_id}",
        "quality": 1,
        "quality_name": "common",
        "icon": "inv_misc_questionmark",
        "ilevel": 0,
    }


async def _fetch_and_cache(
    item_id: int,
    bonus_ids: list[int] | None,
    session: AsyncSession,
    request: Request,
) -> dict[str, Any]:
    """Fetch from Wowhead using the shared HTTP client, store in DB."""
    url = WOWHEAD_TOOLTIP_URL.format(item_id=item_id)
    params: dict[str, Any] = {"dataEnv": 1, "locale": 0}
    if bonus_ids:
        params["bonus"] = ":".join(str(b) for b in bonus_ids)

    client = request.app.state.http_client
    resp = await client.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()

    ilevel = 0
    tooltip = data.get("tooltip", "")
    ilvl_match = re.search(r"<!--ilvl-->(\d+)", tooltip)
    if ilvl_match:
        ilevel = int(ilvl_match.group(1))

    bonus_key = _normalize_bonus(bonus_ids)
    row = ItemCache(
        item_id=item_id,
        bonus_ids=bonus_key,
        name=data.get("name", f"Item {item_id}"),
        quality=data.get("quality", 1),
        icon=data.get("icon", "inv_misc_questionmark"),
        ilevel=ilevel,
    )
    await session.merge(row)
    await session.commit()
    return _row_to_dict(row)


@router.get("/api/item-info/{item_id}")
async def get_item_info(
    item_id: int,
    request: Request,
    bonus_ids: str = "",
    session: AsyncSession = Depends(get_session),
):
    bonus_list = [int(b) for b in bonus_ids.split(",") if b.strip()] if bonus_ids else []
    bonus_key = _normalize_bonus(bonus_list)

    result = await session.execute(
        select(ItemCache).where(
            ItemCache.item_id == item_id,
            ItemCache.bonus_ids == bonus_key,
        )
    )
    cached = result.scalar_one_or_none()
    if cached:
        return _row_to_dict(cached)

    try:
        return await _fetch_and_cache(item_id, bonus_list or None, session, request)
    except Exception as e:
        logger.warning(f"Failed to fetch item {item_id} from Wowhead: {e}")
        return _fallback(item_id)


@router.post("/api/item-info/batch")
async def get_item_info_batch(
    req: ItemInfoRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    """Fetch info for multiple items at once."""
    items_list = req.items
    if not items_list and req.item_ids:
        items_list = [{"item_id": iid} for iid in req.item_ids]

    if not items_list or len(items_list) > 100:
        raise HTTPException(status_code=400, detail="Provide 1-100 items")

    seen: set[str] = set()
    unique_items: list[dict] = []
    for item in items_list:
        iid = item.get("item_id", 0)
        bonus = item.get("bonus_ids") or []
        key = f"{iid}:{_normalize_bonus(bonus)}"
        if key not in seen:
            seen.add(key)
            unique_items.append({"item_id": iid, "bonus_ids": bonus})

    all_ids = [it["item_id"] for it in unique_items]
    result = await session.execute(
        select(ItemCache).where(ItemCache.item_id.in_(all_ids))
    )
    cached_rows: dict[str, ItemCache] = {}
    for row in result.scalars().all():
        cache_key = f"{row.item_id}:{row.bonus_ids}"
        cached_rows[cache_key] = row

    results: dict[str, dict[str, Any]] = {}

    for item in unique_items:
        iid = item["item_id"]
        bonus = item["bonus_ids"]
        bonus_key = _normalize_bonus(bonus)
        cache_key = f"{iid}:{bonus_key}"
        resp_key = str(iid)

        if cache_key in cached_rows:
            results[resp_key] = _row_to_dict(cached_rows[cache_key])
        else:
            try:
                info = await _fetch_and_cache(iid, bonus, session, request)
                results[resp_key] = info
            except Exception as e:
                logger.warning(f"Failed to fetch item {iid}: {e}")
                results[resp_key] = _fallback(iid)

    return results


@router.get("/api/enchant-info/{enchant_id}")
async def get_enchant_info(enchant_id: int, request: Request):
    """Fetch enchant name and icon from Wowhead's spell tooltip API."""
    if enchant_id <= 0:
        return {"enchant_id": enchant_id, "name": "", "icon": ""}

    try:
        client = request.app.state.http_client
        url = WOWHEAD_SPELL_URL.format(spell_id=enchant_id)
        resp = await client.get(url, params={"dataEnv": 1, "locale": 0})
        resp.raise_for_status()
        data = resp.json()
        return {
            "enchant_id": enchant_id,
            "name": data.get("name", ""),
            "icon": data.get("icon", ""),
        }
    except Exception as e:
        logger.warning(f"Failed to fetch enchant {enchant_id}: {e}")
        return {"enchant_id": enchant_id, "name": "", "icon": ""}
