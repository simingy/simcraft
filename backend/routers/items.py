"""Item and enchant info endpoints.

Uses local Raidbots game data files for instant lookups.
Falls back to Wowhead API only for items not found locally.
"""

import logging
import re
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from schemas import ItemInfoRequest
from services import game_data

logger = logging.getLogger(__name__)

router = APIRouter(tags=["items"])

WOWHEAD_TOOLTIP_URL = "https://nether.wowhead.com/tooltip/item/{item_id}"


def _normalize_bonus(bonus_ids: list[int] | None) -> str:
    if not bonus_ids:
        return ""
    return ":".join(str(b) for b in sorted(bonus_ids))


def _fallback(item_id: int) -> dict[str, Any]:
    return {
        "item_id": item_id,
        "name": f"Item {item_id}",
        "quality": 1,
        "quality_name": "common",
        "icon": "inv_misc_questionmark",
        "ilevel": 0,
    }


async def _fetch_from_wowhead(
    item_id: int,
    bonus_ids: list[int] | None,
    request: Request,
) -> dict[str, Any]:
    """Fetch from Wowhead as a fallback for items not in local data."""
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

    return {
        "item_id": item_id,
        "name": data.get("name", f"Item {item_id}"),
        "quality": data.get("quality", 1),
        "quality_name": game_data.QUALITY_NAMES.get(data.get("quality", 1), "common"),
        "icon": data.get("icon", "inv_misc_questionmark"),
        "ilevel": ilevel,
    }


def _resolve_item(item_id: int, bonus_ids: list[int] | None) -> dict[str, Any] | None:
    """Try to resolve item info from local game data."""
    return game_data.get_item_info(item_id, bonus_ids)


@router.get("/api/item-info/{item_id}")
async def get_item_info(
    item_id: int,
    request: Request,
    bonus_ids: str = "",
):
    bonus_list = [int(b) for b in bonus_ids.split(",") if b.strip()] if bonus_ids else []

    # Try local game data first
    local = _resolve_item(item_id, bonus_list or None)
    if local:
        return local

    # Fall back to Wowhead
    try:
        return await _fetch_from_wowhead(item_id, bonus_list or None, request)
    except Exception as e:
        logger.warning(f"Failed to fetch item {item_id} from Wowhead: {e}")
        return _fallback(item_id)


@router.post("/api/item-info/batch")
async def get_item_info_batch(
    req: ItemInfoRequest,
    request: Request,
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

    results: dict[str, dict[str, Any]] = {}

    for item in unique_items:
        iid = item["item_id"]
        bonus = item["bonus_ids"]
        resp_key = str(iid)

        local = _resolve_item(iid, bonus or None)
        if local:
            results[resp_key] = local
        else:
            try:
                info = await _fetch_from_wowhead(iid, bonus, request)
                results[resp_key] = info
            except Exception as e:
                logger.warning(f"Failed to fetch item {iid}: {e}")
                results[resp_key] = _fallback(iid)

    return results


@router.get("/api/enchant-info/{enchant_id}")
async def get_enchant_info(enchant_id: int):
    """Look up enchant name from local game data."""
    info = game_data.get_enchant_info(enchant_id)
    if info:
        return info
    return {"enchant_id": enchant_id, "name": ""}


@router.get("/api/gem-info/{gem_id}")
async def get_gem_info(gem_id: int):
    """Look up gem info by item ID from local game data."""
    info = game_data.get_gem_info(gem_id)
    if info:
        return info
    return {"gem_id": gem_id, "name": "", "icon": "", "quality": 3}
