"""Parse SimC addon export strings to extract equipped and bag/bank items."""

import re
from collections import defaultdict
from typing import Any

GEAR_SLOTS = [
    "head", "neck", "shoulder", "back", "chest", "wrist",
    "hands", "waist", "legs", "feet", "finger1", "finger2",
    "trinket1", "trinket2", "main_hand", "off_hand",
]

SLOT_LABELS = {
    "head": "Head", "neck": "Neck", "shoulder": "Shoulder",
    "back": "Back", "chest": "Chest", "wrist": "Wrist",
    "hands": "Hands", "waist": "Waist", "legs": "Legs",
    "feet": "Feet", "finger1": "Ring 1", "finger2": "Ring 2",
    "trinket1": "Trinket 1", "trinket2": "Trinket 2",
    "main_hand": "Main Hand", "off_hand": "Off Hand",
}

_SLOT_PATTERN = re.compile(
    r"^(" + "|".join(GEAR_SLOTS) + r")=(.*)", re.IGNORECASE
)

# Bag items for these slots should appear in both paired slots
_PAIRED_SLOTS = {
    "finger1": "finger2",
    "finger2": "finger1",
    "trinket1": "trinket2",
    "trinket2": "trinket1",
}


def _parse_item_props(item_str: str) -> dict[str, Any]:
    """Extract item_id, ilevel, bonus_id, enchant, gem from an item string."""
    props: dict[str, Any] = {"item_id": 0, "ilevel": 0, "name": "", "bonus_ids": [], "enchant_id": 0, "gem_id": 0}

    id_match = re.search(r"id=(\d+)", item_str)
    if id_match:
        props["item_id"] = int(id_match.group(1))

    ilvl_match = re.search(r"(?:ilevel|ilvl)=(\d+)", item_str)
    if ilvl_match:
        props["ilevel"] = int(ilvl_match.group(1))

    bonus_match = re.search(r"bonus_id=([0-9/:]+)", item_str)
    if bonus_match:
        props["bonus_ids"] = [
            int(b) for b in re.split(r"[/:]", bonus_match.group(1)) if b
        ]

    enchant_match = re.search(r"enchant_id=(\d+)", item_str)
    if enchant_match:
        props["enchant_id"] = int(enchant_match.group(1))

    gem_match = re.search(r"gem_id=(\d+)", item_str)
    if gem_match:
        props["gem_id"] = int(gem_match.group(1))

    name_match = re.search(r"name=([^,]+)", item_str)
    if name_match:
        props["name"] = name_match.group(1).replace("_", " ").title()

    # Also try to extract the encoded_item name
    enc_match = re.search(r"^([a-z_]+),", item_str)
    if enc_match and not props["name"]:
        props["name"] = enc_match.group(1).replace("_", " ").title()

    return props


def parse_addon_string(simc_input: str) -> dict[str, Any]:
    """Parse a SimC addon string into base profile and items by slot.

    Returns:
        {
            "base_profile": str,  # uncommented lines (the runnable profile)
            "items_by_slot": {
                "head": [
                    {"slot": "head", "simc_string": "...", "item_id": 123,
                     "ilevel": 639, "name": "...", "is_equipped": True},
                    ...
                ],
                ...
            }
        }
    """
    # Matches comment lines like "# Emberwing Feather (246)"
    _header_pattern = re.compile(r"^#+\s*(.+?)\s*\((\d+)\)\s*$")

    equipped: dict[str, dict] = {}
    bag_items: dict[str, list[dict]] = defaultdict(list)
    base_profile_lines: list[str] = []

    # Track the last "# Name (ilvl)" header line
    pending_name = ""
    pending_ilevel = 0

    for raw_line in simc_input.splitlines():
        stripped = raw_line.strip()

        # Commented-out item = bag/bank/vault item
        if stripped.startswith("#"):
            clean = stripped.lstrip("#").strip()
            m = _SLOT_PATTERN.match(clean)
            if m:
                slot = m.group(1).lower()
                item_str = m.group(2)
                props = _parse_item_props(item_str)
                if not props["name"] and pending_name:
                    props["name"] = pending_name
                if not props["ilevel"] and pending_ilevel:
                    props["ilevel"] = pending_ilevel
                pending_name = ""
                pending_ilevel = 0
                item_entry = {
                    "slot": slot,
                    "simc_string": item_str,
                    "is_equipped": False,
                    **props,
                }
                bag_items[slot].append(item_entry)
                # Rings/trinkets: also add to the paired slot
                if slot in _PAIRED_SLOTS:
                    other = _PAIRED_SLOTS[slot]
                    bag_items[other].append({
                        **item_entry,
                        "slot": other,
                    })
            else:
                header_m = _header_pattern.match(stripped)
                if header_m:
                    pending_name = header_m.group(1)
                    pending_ilevel = int(header_m.group(2))
                else:
                    pending_name = ""
                    pending_ilevel = 0
        else:
            base_profile_lines.append(stripped)
            m = _SLOT_PATTERN.match(stripped)
            if m:
                slot = m.group(1).lower()
                item_str = m.group(2)
                props = _parse_item_props(item_str)
                if not props["name"] and pending_name:
                    props["name"] = pending_name
                if not props["ilevel"] and pending_ilevel:
                    props["ilevel"] = pending_ilevel
                pending_name = ""
                pending_ilevel = 0
                equipped[slot] = {
                    "slot": slot,
                    "simc_string": item_str,
                    "is_equipped": True,
                    **props,
                }

    # Build items_by_slot: equipped first, then bag items (deduplicated)
    items_by_slot: dict[str, list[dict]] = {}
    for slot in GEAR_SLOTS:
        items: list[dict] = []
        seen_ids: set[int] = set()
        if slot in equipped:
            items.append(equipped[slot])
            if equipped[slot]["item_id"]:
                seen_ids.add(equipped[slot]["item_id"])
        if slot in bag_items:
            for bag_item in bag_items[slot]:
                # Skip duplicates (same item_id already in this slot)
                iid = bag_item["item_id"]
                if iid and iid in seen_ids:
                    continue
                if iid:
                    seen_ids.add(iid)
                items.append(bag_item)
        if items:
            items_by_slot[slot] = items

    return {
        "base_profile": "\n".join(base_profile_lines),
        "items_by_slot": items_by_slot,
    }
