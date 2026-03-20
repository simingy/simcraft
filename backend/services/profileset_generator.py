"""Generate simc profileset input for Top Gear comparisons.

Aligned with Raidbots' approach:
- Each profileset specifies ALL gear slots (full gear set)
- Unique-equipped constraints are validated
- off_hand is explicitly cleared
- Talents are re-specified per profileset
- Combos are named "Combo N"
"""

import itertools
import re
from typing import Any

from services.addon_parser import GEAR_SLOTS

MAX_COMBINATIONS = 500

# Slots that are unique-equipped (can't have same item in both)
_UNIQUE_SLOT_PAIRS = [
    ("finger1", "finger2"),
    ("trinket1", "trinket2"),
]


def generate_top_gear_input(
    base_profile: str,
    items_by_slot: dict[str, list[dict]],
    selected_items: dict[str, list[int]],
) -> tuple[str, int, dict[str, list[dict]]]:
    """Generate a simc input string with full-set profilesets for Top Gear.

    Each profileset is a complete gear specification (all slots),
    matching how Raidbots generates Top Gear input.

    Returns:
        (simc_input_string, combination_count, combo_metadata)
        combo_metadata maps "Combo N" -> list of {slot, item_id, ilevel, name, is_kept}

    Raises:
        ValueError: If combination count exceeds MAX_COMBINATIONS.
    """
    # Extract base profile info (non-gear lines) and equipped gear
    base_lines, equipped_gear, talents_string = _parse_base_profile(base_profile)

    # Build the option lists per slot for combination generation
    # For each slot, list all selected items (equipped + alternatives)
    slot_item_lists: dict[str, list[dict]] = {}
    for slot in GEAR_SLOTS:
        if slot not in items_by_slot:
            continue
        slot_items = items_by_slot[slot]
        selected_indices = selected_items.get(slot, [])

        # Collect all selected items for this slot
        candidates = []
        for idx in selected_indices:
            if 0 <= idx < len(slot_items):
                candidates.append(slot_items[idx])

        # Also always include the equipped item if not already selected
        equipped = next((it for it in slot_items if it["is_equipped"]), None)
        if equipped and not any(c is equipped for c in candidates):
            candidates.insert(0, equipped)

        if candidates:
            slot_item_lists[slot] = candidates

    # Find slots that have alternatives (more than just equipped)
    varying_slots = [
        slot for slot, items in slot_item_lists.items()
        if len(items) > 1
    ]

    if not varying_slots:
        return "\n".join([base_profile]), 0, {}

    # Build cartesian product across varying slots
    option_lists = [slot_item_lists[slot] for slot in varying_slots]

    # Calculate total combos
    total = 1
    for opts in option_lists:
        total *= len(opts)

    # Generate all combos, filter invalid ones
    valid_combos: list[dict[str, dict]] = []
    for combo in itertools.product(*option_lists):
        # Build full gear set: start with equipped, override varying slots
        gear_set: dict[str, dict] = {}
        for slot in GEAR_SLOTS:
            if slot in slot_item_lists and slot_item_lists[slot]:
                # Use equipped item as default
                gear_set[slot] = next(
                    (it for it in slot_item_lists[slot] if it["is_equipped"]),
                    slot_item_lists[slot][0],
                )

        # Apply the combo choices
        for i, slot in enumerate(varying_slots):
            gear_set[slot] = combo[i]

        # Validate unique-equipped constraints
        if not _validate_unique_equipped(gear_set):
            continue

        # Check if this is identical to baseline (all equipped)
        is_baseline = all(
            gear_set.get(slot, {}).get("is_equipped", True)
            for slot in GEAR_SLOTS
        )
        if is_baseline:
            continue

        valid_combos.append(gear_set)

    combo_count = len(valid_combos)
    if combo_count > MAX_COMBINATIONS:
        raise ValueError(
            f"Too many combinations ({combo_count}). "
            f"Maximum is {MAX_COMBINATIONS}. Please deselect some items."
        )

    if combo_count == 0:
        return "\n".join([base_profile]), 0, {}

    # Build output: base profile as Combo 1, then profilesets
    lines = []
    combo_metadata: dict[str, list[dict]] = {}

    # Write clean base profile (non-gear lines + equipped gear)
    lines.append("# Base Actor")
    lines.extend(base_lines)
    lines.append("### Combo 1")
    for slot in GEAR_SLOTS:
        if slot in equipped_gear:
            lines.append(f"{slot}={equipped_gear[slot]}")
        elif slot == "off_hand":
            lines.append("off_hand=,")
    if talents_string:
        lines.append(f"talents={talents_string}")
    lines.append("")

    # Build baseline metadata for "Currently Equipped"
    combo_metadata["Currently Equipped"] = [
        _item_meta(slot_item_lists.get(slot, [{}])[0], slot)
        for slot in ["finger1", "finger2", "trinket1", "trinket2"]
        if slot in slot_item_lists and slot_item_lists[slot]
    ]

    # Generate profilesets for each combo
    for combo_idx, gear_set in enumerate(valid_combos, start=2):
        combo_name = f"Combo {combo_idx}"
        lines.append(f"### {combo_name}")

        for slot in GEAR_SLOTS:
            if slot in gear_set:
                item = gear_set[slot]
                simc_str = item["simc_string"]
                lines.append(
                    f'profileset."{combo_name}"+={slot}={simc_str}'
                )
            elif slot == "off_hand":
                lines.append(f'profileset."{combo_name}"+=off_hand=,')

        if talents_string:
            lines.append(
                f'profileset."{combo_name}"+=talents={talents_string}'
            )
        lines.append("")

        # Build metadata: track what's different from baseline
        # For paired slots, always include both items
        combo_items: list[dict] = []
        for slot in ["finger1", "finger2", "trinket1", "trinket2"]:
            if slot in gear_set:
                item = gear_set[slot]
                meta = _item_meta(item, slot)
                # Mark as kept if it's the equipped item
                meta["is_kept"] = item.get("is_equipped", False)
                combo_items.append(meta)

        # Also include non-paired slots that changed
        for slot in GEAR_SLOTS:
            if slot in ("finger1", "finger2", "trinket1", "trinket2"):
                continue
            if slot in gear_set and not gear_set[slot].get("is_equipped", True):
                combo_items.append(_item_meta(gear_set[slot], slot))

        combo_metadata[combo_name] = combo_items

    return "\n".join(lines), combo_count, combo_metadata


def _parse_base_profile(
    base_profile: str,
) -> tuple[list[str], dict[str, str], str]:
    """Split base profile into non-gear lines, equipped gear, and talents.

    Returns:
        (non_gear_lines, equipped_gear_by_slot, talents_string)
    """
    non_gear_lines: list[str] = []
    equipped_gear: dict[str, str] = {}
    talents_string = ""
    gear_pattern = re.compile(
        r"^(" + "|".join(GEAR_SLOTS) + r")=(.*)", re.IGNORECASE
    )

    for line in base_profile.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        # Extract talents
        talents_match = re.match(r"^talents=(.+)", stripped)
        if talents_match:
            talents_string = talents_match.group(1)
            # Still include in non-gear for the base actor
            continue

        # Extract gear lines
        gear_match = gear_pattern.match(stripped)
        if gear_match:
            slot = gear_match.group(1).lower()
            equipped_gear[slot] = gear_match.group(2)
            continue

        # Keep everything else (character definition, comments, etc.)
        non_gear_lines.append(stripped)

    return non_gear_lines, equipped_gear, talents_string


def _item_meta(item: dict[str, Any], slot: str) -> dict[str, Any]:
    """Create metadata dict for an item."""
    return {
        "slot": slot,
        "item_id": item.get("item_id", 0),
        "ilevel": item.get("ilevel", 0),
        "name": item.get("name", ""),
        "bonus_ids": item.get("bonus_ids", []),
        "enchant_id": item.get("enchant_id", 0),
        "gem_id": item.get("gem_id", 0),
        "is_kept": item.get("is_equipped", False),
    }


def _validate_unique_equipped(gear_set: dict[str, dict]) -> bool:
    """Check that unique-equipped items aren't in both paired slots."""
    for slot1, slot2 in _UNIQUE_SLOT_PAIRS:
        item1 = gear_set.get(slot1)
        item2 = gear_set.get(slot2)
        if not item1 or not item2:
            continue
        id1 = item1.get("item_id", 0)
        id2 = item2.get("item_id", 0)
        if id1 and id2 and id1 == id2:
            return False
    return True
