"""In-memory game data loaded from Raidbots static JSON files.

Provides instant lookups for items, enchants, bonuses, and item curves
without needing Wowhead API calls.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# In-memory lookup tables populated by load()
_items: dict[int, dict] = {}
_enchants: dict[int, dict] = {}
_enchants_by_item_id: dict[int, dict] = {}
_bonuses: dict[int, dict] = {}
_item_curves: dict[int, dict] = {}


def load():
    """Load all game data files into memory. Call once at startup."""
    global _items, _enchants, _enchants_by_item_id, _bonuses, _item_curves

    # equippable-items-full.json — array of {id, name, icon, quality, itemLevel, ...}
    items_path = DATA_DIR / "equippable-items-full.json"
    if items_path.exists():
        with open(items_path, encoding="utf-8") as f:
            items_list = json.load(f)
        _items = {item["id"]: item for item in items_list}
        logger.info(f"Loaded {len(_items)} items from equippable-items-full.json")

    # enchantments.json — array of {id, displayName, spellIcon, ...}
    enchants_path = DATA_DIR / "enchantments.json"
    if enchants_path.exists():
        with open(enchants_path, encoding="utf-8") as f:
            enchants_list = json.load(f)
        _enchants = {e["id"]: e for e in enchants_list}
        _enchants_by_item_id = {
            e["itemId"]: e for e in enchants_list if "itemId" in e
        }
        logger.info(f"Loaded {len(_enchants)} enchants from enchantments.json")

    # bonuses.json — object keyed by bonus ID string
    bonuses_path = DATA_DIR / "bonuses.json"
    if bonuses_path.exists():
        with open(bonuses_path, encoding="utf-8") as f:
            bonuses_raw = json.load(f)
        _bonuses = {int(k): v for k, v in bonuses_raw.items()}
        logger.info(f"Loaded {len(_bonuses)} bonuses from bonuses.json")

    # item-curves.json — object keyed by curve ID string
    curves_path = DATA_DIR / "item-curves.json"
    if curves_path.exists():
        with open(curves_path, encoding="utf-8") as f:
            curves_raw = json.load(f)
        _item_curves = {int(k): v for k, v in curves_raw.items()}
        logger.info(f"Loaded {len(_item_curves)} curves from item-curves.json")


def get_item(item_id: int) -> dict | None:
    """Look up an item by ID. Returns dict with id, name, icon, quality, itemLevel."""
    return _items.get(item_id)


def get_enchant(enchant_id: int) -> dict | None:
    """Look up an enchant by ID. Returns dict with id, displayName, spellIcon, etc."""
    return _enchants.get(enchant_id)


def get_bonus(bonus_id: int) -> dict | None:
    """Look up bonus data by ID."""
    return _bonuses.get(bonus_id)


def _resolve_bonuses(bonus_ids: list[int]) -> dict[str, Any]:
    """Extract quality, ilvl, tag, socket, and upgrade info from bonus IDs."""
    result: dict[str, Any] = {}
    for bid in bonus_ids:
        bonus = _bonuses.get(bid)
        if not bonus:
            continue
        if "quality" in bonus:
            result["quality"] = bonus["quality"]
        if "itemLevel" in bonus:
            result["ilevel"] = bonus["itemLevel"]["amount"]
        if "tag" in bonus:
            result["tag"] = bonus["tag"]
        if "socket" in bonus:
            result["sockets"] = bonus["socket"]
        if "upgrade" in bonus:
            result["upgrade"] = bonus["upgrade"].get("fullName", "")
    return result


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


def get_item_info(item_id: int, bonus_ids: list[int] | None = None) -> dict[str, Any] | None:
    """Get full item info dict ready for API response, or None if not found.

    Applies bonus ID overrides for quality, item level, tag, sockets, and
    upgrade track info.
    """
    item = _items.get(item_id)
    if not item:
        return None

    quality = item.get("quality", 1)
    ilevel = item.get("itemLevel", 0)
    tag = ""
    sockets = 0
    upgrade = ""

    if bonus_ids:
        resolved = _resolve_bonuses(bonus_ids)
        quality = resolved.get("quality", quality)
        ilevel = resolved.get("ilevel", ilevel)
        tag = resolved.get("tag", "")
        sockets = resolved.get("sockets", 0)
        upgrade = resolved.get("upgrade", "")

    return {
        "item_id": item_id,
        "name": item.get("name", f"Item {item_id}"),
        "quality": quality,
        "quality_name": QUALITY_NAMES.get(quality, "common"),
        "icon": item.get("icon", "inv_misc_questionmark"),
        "ilevel": ilevel,
        "tag": tag,
        "sockets": sockets,
        "upgrade": upgrade,
    }


def get_enchant_info(enchant_id: int) -> dict[str, Any] | None:
    """Get enchant info dict ready for API response, or None if not found."""
    enchant = _enchants.get(enchant_id)
    if not enchant:
        return None
    return {
        "enchant_id": enchant_id,
        "name": enchant.get("itemName") or enchant.get("displayName", ""),
    }


def get_gem_info(gem_item_id: int) -> dict[str, Any] | None:
    """Look up gem by its item ID (gem_id in SimC = itemId in enchantments.json)."""
    gem = _enchants_by_item_id.get(gem_item_id)
    if not gem:
        return None
    return {
        "gem_id": gem_item_id,
        "name": gem.get("itemName") or gem.get("displayName", ""),
        "icon": gem.get("itemIcon") or gem.get("spellIcon", ""),
        "quality": gem.get("quality", 3),
    }
