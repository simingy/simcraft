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
# Maps upgrade bonus_id -> max-level bonus_id in the same group
_upgrade_max: dict[int, int] = {}


def load():
    """Load all game data files into memory. Call once at startup."""
    global _items, _enchants, _enchants_by_item_id, _bonuses, _item_curves, _upgrade_max

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
        # Build upgrade group index: for each upgrade bonus, find the max-level bonus
        groups: dict[int, list[dict]] = {}
        for b in _bonuses.values():
            if "upgrade" in b:
                gid = b["upgrade"]["group"]
                groups.setdefault(gid, []).append(b)
        for members in groups.values():
            max_bonus = max(members, key=lambda b: b["upgrade"]["level"])
            for b in members:
                _upgrade_max[b["id"]] = max_bonus["id"]
        logger.info(f"Loaded {len(_bonuses)} bonuses, {len(groups)} upgrade groups")

    # item-curves.json — object keyed by curve ID string
    curves_path = DATA_DIR / "item-curves.json"
    if curves_path.exists():
        with open(curves_path, encoding="utf-8") as f:
            curves_raw = json.load(f)
        _item_curves = {int(k): v for k, v in curves_raw.items()}
        logger.info(f"Loaded {len(_item_curves)} curves from item-curves.json")



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


def get_item_armor_subclass(item_id: int) -> int | None:
    """Returns the armor subclass: 0=Misc, 1=Cloth, 2=Leather, 3=Mail, 4=Plate.

    Returns None if not found or not armor (itemClass != 4).
    """
    item = _items.get(item_id)
    if not item:
        return None
    if item.get("itemClass") != 4:
        return None
    return item.get("itemSubClass")


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

    armor_subclass = item.get("itemSubClass", 0) if item.get("itemClass") == 4 else 0

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
        "armor_subclass": armor_subclass,
    }


def get_upgrade_options(bonus_ids: list[int]) -> list[dict[str, Any]] | None:
    """Get all upgrade levels for an item's bonus IDs.

    Returns list of {bonus_id, level, max, name, fullName, itemLevel} sorted by level,
    or None if the item has no upgrade track.
    """
    for bid in bonus_ids:
        if bid in _upgrade_max:
            # Found an upgrade bonus — get its group
            bonus = _bonuses.get(bid)
            if not bonus or "upgrade" not in bonus:
                continue
            group_id = bonus["upgrade"]["group"]
            # Find all bonuses in this group
            members = [
                b for b in _bonuses.values()
                if "upgrade" in b and b["upgrade"]["group"] == group_id
            ]
            members.sort(key=lambda b: b["upgrade"]["level"])
            return [
                {
                    "bonus_id": b["id"],
                    "level": b["upgrade"]["level"],
                    "max": b["upgrade"]["max"],
                    "name": b["upgrade"]["name"],
                    "fullName": b["upgrade"]["fullName"],
                    "itemLevel": b["upgrade"]["itemLevel"],
                }
                for b in members
            ]
    return None


def swap_upgrade_bonus(bonus_ids: list[int], new_upgrade_bonus_id: int) -> list[int]:
    """Replace the upgrade bonus ID in a list with a different one."""
    return [
        new_upgrade_bonus_id if bid in _upgrade_max else bid
        for bid in bonus_ids
    ]


def upgrade_bonus_ids_to_max(bonus_ids: list[int]) -> list[int]:
    """Replace any upgrade bonus ID with the max-level bonus in its group."""
    return [_upgrade_max.get(bid, bid) for bid in bonus_ids]


def upgrade_simc_input(simc_input: str) -> str:
    """Rewrite all bonus_id= values in a simc input string to max upgrade level."""
    import re

    def _replace_bonus(match: re.Match) -> str:
        raw = match.group(1)
        ids = [int(b) for b in re.split(r"[/:]", raw) if b]
        upgraded = upgrade_bonus_ids_to_max(ids)
        sep = "/" if "/" in raw else ":"
        return f"bonus_id={sep.join(str(b) for b in upgraded)}"

    return re.sub(r"bonus_id=([0-9/:]+)", _replace_bonus, simc_input)


def upgrade_items_by_slot(items_by_slot: dict[str, list[dict]]) -> dict[str, list[dict]]:
    """Upgrade all items in items_by_slot to their max upgrade level.

    Updates bonus_ids, simc_string, and ilevel for each item.
    """
    import re

    upgraded: dict[str, list[dict]] = {}
    for slot, items in items_by_slot.items():
        new_items = []
        for item in items:
            item = dict(item)  # shallow copy
            old_bonus_ids = item.get("bonus_ids", [])
            new_bonus_ids = upgrade_bonus_ids_to_max(old_bonus_ids)

            if new_bonus_ids != old_bonus_ids:
                item["bonus_ids"] = new_bonus_ids
                # Update simc_string with new bonus_ids
                simc = item.get("simc_string", "")
                if simc:
                    def _replace_bonus(match: re.Match) -> str:
                        raw = match.group(1)
                        sep = "/" if "/" in raw else ":"
                        return f"bonus_id={sep.join(str(b) for b in new_bonus_ids)}"
                    item["simc_string"] = re.sub(r"bonus_id=([0-9/:]+)", _replace_bonus, simc)

                # Recalculate ilevel from the base item + new bonuses
                item_id = item.get("item_id", 0)
                base_item = _items.get(item_id)
                if base_item:
                    base_ilevel = base_item.get("itemLevel", 0)
                    resolved = _resolve_bonuses(new_bonus_ids)
                    item["ilevel"] = resolved.get("ilevel", base_ilevel)

            new_items.append(item)
        upgraded[slot] = new_items
    return upgraded


def apply_copy_enchants(items_by_slot: dict[str, list[dict]]) -> dict[str, list[dict]]:
    """Copy the equipped item's enchant to all alternatives in the same slot.

    Modifies both the item dict (enchant_id) and the simc_string.
    """
    import re

    result = {}
    for slot, items in items_by_slot.items():
        equipped = next((it for it in items if it.get("is_equipped")), None)
        if not equipped or not equipped.get("enchant_id"):
            result[slot] = items
            continue

        ench_id = equipped["enchant_id"]
        new_items = []
        for item in items:
            if item.get("is_equipped") or item.get("enchant_id") == ench_id:
                new_items.append(item)
                continue
            # Copy enchant to this alternative
            updated = {**item, "enchant_id": ench_id}
            simc = item.get("simc_string", "")
            if "enchant_id=" in simc:
                simc = re.sub(r"enchant_id=\d+", f"enchant_id={ench_id}", simc)
            else:
                # Insert enchant_id after the id= field
                simc = re.sub(r"(,id=\d+)", rf"\1,enchant_id={ench_id}", simc)
            updated["simc_string"] = simc
            new_items.append(updated)
        result[slot] = new_items
    return result


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
