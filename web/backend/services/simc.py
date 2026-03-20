import asyncio
import json
import logging
import re
import shutil
import tempfile
from pathlib import Path

from config import settings

logger = logging.getLogger(__name__)

_OVERRIDES = [
    "override.bloodlust=1",
    "override.arcane_intellect=1",
    "override.power_word_fortitude=1",
    "override.battle_shout=1",
    "override.mystic_touch=1",
    "override.chaos_brand=1",
    "override.skyfury=1",
    "override.mark_of_the_wild=1",
    "override.hunters_mark=1",
    "override.bleeding=1",
]

_SIM_OPTIONS = [
    "report_details=1",
    "single_actor_batch=1",
    "optimize_expressions=1",
    "desired_targets=1",
    "max_time=300",
    "temporary_enchant=",
    "scale_only=strength,intellect,agility,crit,mastery,vers,haste,weapon_dps,weapon_offhand_dps",
]

_EXPANSION_OPTIONS = [
    "midnight.crucible_of_erratic_energies_violence=1",
    "midnight.crucible_of_erratic_energies_sustenance=1",
    "midnight.crucible_of_erratic_energies_predation=1",
]

_STAGES = [
    {"name": "Low", "target_error": 1.0, "keep_top": 0.5, "min_keep": 10},
    {"name": "Medium", "target_error": 0.2, "keep_top": 0.3, "min_keep": 5},
    {"name": "High", "target_error": 0.05, "keep_top": 1.0, "min_keep": 1},
]

_STAGED_THRESHOLD = 10


async def _run_simc_subprocess(
    job_id: str,
    simc_input: str,
    fight_style: str,
    target_error: float,
    iterations: int = 10000,
    calculate_scale_factors: bool = False,
    stage_name: str = "",
) -> dict:
    """Run a single simc subprocess and return parsed JSON."""
    suffix = f"_{stage_name}" if stage_name else ""
    tmp_dir = Path(tempfile.mkdtemp(prefix=f"simc_{job_id}{suffix}_"))
    input_file = tmp_dir / "input.simc"
    output_file = tmp_dir / "output.json"

    try:
        input_file.write_text(simc_input)

        cmd = [
            settings.SIMC_PATH,
            str(input_file),
            f"json2={output_file}",
            f"iterations={iterations}",
            f"fight_style={fight_style}",
            f"target_error={target_error}",
            f"threads={settings.SIMC_THREADS}",
            f"calculate_scale_factors={'1' if calculate_scale_factors else '0'}",
            *_OVERRIDES,
            *_SIM_OPTIONS,
            *_EXPANSION_OPTIONS,
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=settings.SIMC_TIMEOUT,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            raise RuntimeError(
                f"simc timed out after {settings.SIMC_TIMEOUT}s"
            )

        if process.returncode != 0:
            error_msg = stderr.decode() or stdout.decode() or "simc exited with non-zero code"
            raise RuntimeError(f"simc failed (exit {process.returncode}): {error_msg}")

        if not output_file.exists():
            raise RuntimeError("simc did not produce output JSON")

        return json.loads(output_file.read_text())

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _get_profileset_results(raw: dict) -> list[dict]:
    return raw.get("sim", {}).get("profilesets", {}).get("results", [])


def _filter_simc_input(simc_input: str, keep_combos: set[str]) -> str:
    """Remove profilesets not in keep_combos. Preserves the base actor."""
    lines = simc_input.split("\n")
    output: list[str] = []
    current_combo: str | None = None
    in_kept_combo = True

    for line in lines:
        header_match = re.match(r"^###\s+(Combo \d+)", line)
        if header_match:
            current_combo = header_match.group(1)
            in_kept_combo = current_combo in keep_combos
            if in_kept_combo:
                output.append(line)
            continue

        if line.strip().startswith("profileset."):
            if in_kept_combo:
                output.append(line)
            continue

        if current_combo and line.strip().startswith("#"):
            if in_kept_combo:
                output.append(line)
            continue

        output.append(line)
        current_combo = None
        in_kept_combo = True

    return "\n".join(output)


async def run_simc(job_id: str, simc_input: str, options: dict) -> dict:
    """Run simc and return parsed JSON output."""
    return await _run_simc_subprocess(
        job_id=job_id,
        simc_input=simc_input,
        fight_style=options.get("fight_style", "Patchwerk"),
        target_error=options.get("target_error", 0.2),
        iterations=options.get("iterations", 1000),
        calculate_scale_factors=options.get("sim_type") == "stat_weights",
    )


async def run_simc_staged(
    job_id: str,
    simc_input: str,
    options: dict,
    combo_count: int,
    on_progress=None,
    on_stage_complete=None,
) -> dict:
    """Run a multi-stage simulation for Top Gear."""
    fight_style = options.get("fight_style", "Patchwerk")
    user_iterations = options.get("iterations", 1000)

    async def _progress(pct: int, stage: str, detail: str):
        if on_progress:
            await on_progress(pct, stage, detail)

    async def _stage_complete(summary: str):
        if on_stage_complete:
            await on_stage_complete(summary)

    if combo_count < _STAGED_THRESHOLD:
        await _progress(10, "Simulating", f"{combo_count} combos")
        return await _run_simc_subprocess(
            job_id=job_id,
            simc_input=simc_input,
            fight_style=fight_style,
            target_error=options.get("target_error", 0.2),
            iterations=user_iterations,
            stage_name="direct",
        )

    current_input = simc_input
    remaining = combo_count
    result = None

    # Collect eliminated combos' results so they appear in final output
    eliminated: dict[str, dict] = {}

    stage_iterations = [
        max(100, user_iterations // 10),
        max(500, user_iterations // 2),
        user_iterations,
    ]

    stage_ranges = [(10, 40), (40, 70), (70, 95)]

    for stage_idx, stage in enumerate(_STAGES):
        is_final = stage_idx == len(_STAGES) - 1
        range_start, _range_end = stage_ranges[stage_idx]

        await _progress(
            range_start,
            f"Stage {stage_idx + 1} of {len(_STAGES)}",
            f"{remaining} combos · {stage['name']} precision",
        )

        logger.info(
            f"Job {job_id}: Stage {stage['name']} — "
            f"{remaining} combos, target_error={stage['target_error']}, "
            f"iterations={stage_iterations[stage_idx]}"
        )

        result = await _run_simc_subprocess(
            job_id=job_id,
            simc_input=current_input,
            fight_style=fight_style,
            target_error=stage["target_error"],
            iterations=stage_iterations[stage_idx],
            stage_name=stage["name"].lower(),
        )

        if is_final:
            await _stage_complete(f"{stage['name']} · {remaining} combos · done")
            break

        profilesets = _get_profileset_results(result)
        if not profilesets:
            await _stage_complete(f"{stage['name']} · no results")
            break

        keep_count = max(
            stage["min_keep"],
            int(len(profilesets) * stage["keep_top"]),
        )

        if keep_count >= len(profilesets):
            await _stage_complete(
                f"{stage['name']} · kept all {len(profilesets)} combos"
            )
            continue

        sorted_ps = sorted(profilesets, key=lambda p: p.get("mean", 0), reverse=True)
        keep_combos = {ps["name"] for ps in sorted_ps[:keep_count]}

        # Save eliminated combos' DPS from this stage
        for ps in sorted_ps:
            name = ps.get("name", "")
            if name and name not in keep_combos:
                eliminated[name] = ps

        await _stage_complete(
            f"{stage['name']} · {len(profilesets)} → {len(keep_combos)} combos"
        )

        logger.info(
            f"Job {job_id}: Stage {stage['name']} complete — "
            f"keeping {len(keep_combos)}/{len(profilesets)} combos"
        )

        current_input = _filter_simc_input(current_input, keep_combos)
        remaining = len(keep_combos)

    # Inject eliminated combos into the final result so all combos appear
    if eliminated and result:
        final_results = _get_profileset_results(result)
        final_names = {ps.get("name") for ps in final_results}
        for name, ps in eliminated.items():
            if name not in final_names:
                final_results.append(ps)
        # Write back (mutates result in place via the list reference)

    return result
