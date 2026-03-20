import re
from typing import Any


def _extract_version(raw: dict) -> str:
    """Build a version string from simc JSON metadata."""
    version = raw.get("version", "")
    git_rev = raw.get("git_revision", "")
    git_branch = raw.get("git_branch", "")
    build_date = raw.get("build_date", "")
    parts = []
    if version:
        parts.append(f"SimC {version}")
    if git_branch:
        parts.append(git_branch)
    if git_rev:
        parts.append(git_rev[:7])
    if build_date:
        parts.append(build_date)
    return " / ".join(parts) if parts else "Unknown"


def parse_simc_result(raw: dict) -> dict[str, Any]:
    """Extract key metrics from raw simc JSON output."""
    sim = raw.get("sim", {})
    players = sim.get("players", [])

    if not players:
        return {"error": "No player data found in simulation output"}

    player = players[0]
    collected = player.get("collected_data", {})
    dps_data = collected.get("dps", {})

    result: dict[str, Any] = {
        "player_name": player.get("name", "Unknown"),
        "player_class": player.get("specialization", player.get("type", "Unknown")),
        "dps": round(dps_data.get("mean", 0), 1),
        "dps_error": round(dps_data.get("mean_std_dev", 0), 1),
        "fight_length": round(
            sim.get("statistics", {}).get("simulation_length", {}).get("mean", 0), 1
        ),
        "simc_version": _extract_version(raw),
    }

    # Ability breakdown
    stats = player.get("stats", [])
    abilities = []
    for stat in stats:
        name = stat.get("name", "")
        portion_aps = stat.get("portion_aps", {})
        if isinstance(portion_aps, dict):
            dps_contribution = portion_aps.get("mean", 0)
        else:
            dps_contribution = portion_aps or 0
        school = stat.get("school", "physical")
        if name and dps_contribution > 0:
            abilities.append(
                {
                    "name": name,
                    "portion_dps": round(dps_contribution, 1),
                    "school": school,
                }
            )
    abilities.sort(key=lambda a: a["portion_dps"], reverse=True)
    result["abilities"] = abilities

    # Stat weights
    scaling = player.get("scale_factors", {})
    if scaling:
        stat_weights = {}
        for stat_name, value in scaling.items():
            if isinstance(value, (int, float)) and value != 0:
                stat_weights[stat_name] = round(value, 4)
        if stat_weights:
            result["stat_weights"] = dict(
                sorted(stat_weights.items(), key=lambda x: x[1], reverse=True)
            )

    return result


_PAIRED_SLOTS = {
    "finger1": "finger2",
    "finger2": "finger1",
    "trinket1": "trinket2",
    "trinket2": "trinket1",
}

_PAIRED_SLOT_SET = {"finger1", "finger2", "trinket1", "trinket2"}


def _extract_baseline_gear(player: dict) -> dict[str, dict]:
    """Extract equipped item info per slot from simc player gear data."""
    gear = player.get("gear", {})
    baseline: dict[str, dict] = {}
    for slot, data in gear.items():
        if slot not in _PAIRED_SLOT_SET:
            continue
        encoded = data.get("encoded_item", "")
        # Parse item_id from encoded_item string
        item_id = 0
        ilevel = 0
        id_match = re.search(r"id=(\d+)", encoded)
        if id_match:
            item_id = int(id_match.group(1))
        ilvl_match = re.search(r"ilevel=(\d+)", encoded)
        if ilvl_match:
            ilevel = int(ilvl_match.group(1))
        # Also check the direct ilevel field in gear data
        if not ilevel:
            ilevel = data.get("ilevel", 0)
        bonus_ids = []
        bonus_match = re.search(r"bonus_id=([0-9/:]+)", encoded)
        if bonus_match:
            bonus_ids = [
                int(b) for b in re.split(r"[/:]", bonus_match.group(1)) if b
            ]
        enchant_id = 0
        enchant_match = re.search(r"enchant_id=(\d+)", encoded)
        if enchant_match:
            enchant_id = int(enchant_match.group(1))
        gem_id = 0
        gem_match = re.search(r"gem_id=(\d+)", encoded)
        if gem_match:
            gem_id = int(gem_match.group(1))
        name = data.get("name", "").replace("_", " ").title()
        baseline[slot] = {
            "slot": slot,
            "item_id": item_id,
            "ilevel": ilevel,
            "name": name,
            "bonus_ids": bonus_ids,
            "enchant_id": enchant_id,
            "gem_id": gem_id,
            "is_kept": True,
        }
    return baseline


def parse_top_gear_result(
    raw: dict, combo_metadata: dict[str, list[dict]] | None = None,
) -> dict[str, Any]:
    """Extract profileset results from simc JSON output for Top Gear.

    Uses combo_metadata (generated at profileset creation time) to map
    "Combo N" names to item details with icons/names.
    """
    if combo_metadata is None:
        combo_metadata = {}

    sim = raw.get("sim", {})
    players = sim.get("players", [])

    if not players:
        return {"type": "top_gear", "error": "No player data found"}

    player = players[0]
    collected = player.get("collected_data", {})
    base_dps = collected.get("dps", {}).get("mean", 0)

    profilesets = sim.get("profilesets", {}).get("results", [])

    results = []
    for ps in profilesets:
        mean_dps = ps.get("mean", 0)
        combo_name = ps.get("name", "Unknown")

        # Look up pre-computed item metadata for this combo
        items = combo_metadata.get(combo_name, [])

        results.append({
            "name": combo_name,
            "items": items,
            "dps": round(mean_dps, 1),
            "delta": round(mean_dps - base_dps, 1),
        })

    # Add the base (equipped) profile
    baseline_items = combo_metadata.get("Currently Equipped", [])
    # If no metadata, fall back to extracting from simc gear data
    if not baseline_items:
        baseline_gear = _extract_baseline_gear(player)
        baseline_items = list(baseline_gear.values())

    results.append({
        "name": "Currently Equipped",
        "items": baseline_items,
        "dps": round(base_dps, 1),
        "delta": 0,
    })

    results.sort(key=lambda r: r["dps"], reverse=True)

    return {
        "type": "top_gear",
        "base_dps": round(base_dps, 1),
        "player_name": player.get("name", "Unknown"),
        "player_class": player.get(
            "specialization", player.get("type", "Unknown")
        ),
        "simc_version": _extract_version(raw),
        "results": results,
    }
