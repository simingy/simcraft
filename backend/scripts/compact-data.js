/**
 * Compact game data for production builds.
 *
 * Reads from the full Raidbots data directory and outputs a stripped version
 * containing only the files and fields that simhammer-core actually uses.
 *
 * Usage:  node compact-data.js <input-dir> <output-dir>
 *
 * ── MANIFEST ──────────────────────────────────────────────────────────
 * When game_data.rs starts using new files or fields, update this manifest.
 * Everything not listed here is stripped from the build output.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Manifest: which files to include and which fields to keep per file.
//   null = copy the whole file as-is (minified)
//   [...] = keep only these top-level fields per array element / object value
// ---------------------------------------------------------------------------
const MANIFEST = {
  // Items — only keep fields accessed by game_data.rs.
  // Also filter out items without sources (not droppable = not needed).
  "equippable-items-full.json": {
    // Handled specially — see compactItems()
    custom: true,
  },

  // Enchantments — keep fields used for enchant/gem lookups
  "enchantments.json": {
    fields: [
      "id", "displayName", "itemId", "itemName", "itemIcon",
      "spellIcon", "quality",
    ],
  },

  // Bonuses — object keyed by bonus ID. Keep fields used for resolution.
  "bonuses.json": {
    fields: [
      "id", "quality", "itemLevel", "tag", "socket", "upgrade",
    ],
  },

  // Upgrade track data — small file, keep as-is
  "bonus-upgrade-sets.json": null,

  // Seasons — small file, keep as-is
  "seasons.json": null,

  // Instances — small file, keep as-is
  "instances.json": null,

  // Season config — our own file, keep as-is
  "season-config.json": null,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

// Fields needed for item lookups (get_item_info, armor filtering, etc.)
const ITEM_BASE_FIELDS = [
  "id", "name", "icon", "quality", "itemLevel",
  "itemClass", "itemSubClass", "inventoryType",
];

// Additional fields needed for droppable items (droptimizer, spec filtering)
const ITEM_DROP_FIELDS = [...ITEM_BASE_FIELDS, "sources", "specs"];

/**
 * Compact equippable-items-full.json:
 * - Current expansion items: keep all needed fields
 * - Older items with drop sources: keep drop fields (for timewalking etc.)
 * - Older items without sources: keep only base fields for item lookups
 */
function compactItems(inputPath, outputPath) {
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  // Detect current expansion as the highest expansion number
  const currentExp = Math.max(...data.map(i => i.expansion || 0));

  const result = data.map(item => {
    const hasSources = item.sources && item.sources.length > 0;
    const isCurrent = (item.expansion || 0) === currentExp;

    // Current expansion or has drop sources: keep drop-related fields
    if (isCurrent || hasSources) {
      const out = pickFields(item, ITEM_DROP_FIELDS);
      // Strip sources down to just encounterId
      if (out.sources) {
        out.sources = out.sources.map(s => ({ encounterId: s.encounterId }));
      }
      return out;
    }

    // Older items without sources: minimal fields for item lookups only
    return pickFields(item, ITEM_BASE_FIELDS);
  });

  fs.writeFileSync(outputPath, JSON.stringify(result));
}

function pickFields(obj, fields) {
  const result = {};
  for (const f of fields) {
    if (f in obj) result[f] = obj[f];
  }
  return result;
}

function compactFile(inputPath, outputPath, config) {
  if (config && config.custom) {
    compactItems(inputPath, outputPath);
    return;
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);

  if (config === null) {
    // Just minify
    fs.writeFileSync(outputPath, JSON.stringify(data));
    return;
  }

  const { fields, filter, transform } = config;

  if (Array.isArray(data)) {
    // Array of objects (items, enchantments)
    let items = data;
    if (filter) items = items.filter(filter);
    if (fields) items = items.map(item => pickFields(item, fields));
    if (transform) items = items.map(transform);
    fs.writeFileSync(outputPath, JSON.stringify(items));
  } else if (typeof data === "object") {
    // Object keyed by ID (bonuses, bonus-upgrade-sets)
    const result = {};
    for (const [key, value] of Object.entries(data)) {
      if (fields && typeof value === "object" && !Array.isArray(value)) {
        result[key] = pickFields(value, fields);
      } else {
        result[key] = value;
      }
    }
    fs.writeFileSync(outputPath, JSON.stringify(result));
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node compact-data.js <input-dir> <output-dir>");
    process.exit(1);
  }

  const [inputDir, outputDir] = args;

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  let totalIn = 0;
  let totalOut = 0;

  for (const [filename, config] of Object.entries(MANIFEST)) {
    const inputPath = path.join(inputDir, filename);
    const outputPath = path.join(outputDir, filename);

    if (!fs.existsSync(inputPath)) {
      console.warn(`  SKIP  ${filename} (not found)`);
      continue;
    }

    const inSize = fs.statSync(inputPath).size;
    compactFile(inputPath, outputPath, config);
    const outSize = fs.statSync(outputPath).size;

    totalIn += inSize;
    totalOut += outSize;

    const pct = ((1 - outSize / inSize) * 100).toFixed(0);
    console.log(
      `  ${filename.padEnd(35)} ${fmt(inSize)} -> ${fmt(outSize)}  (-${pct}%)`
    );
  }

  console.log(
    `\n  Total: ${fmt(totalIn)} -> ${fmt(totalOut)}  (-${((1 - totalOut / totalIn) * 100).toFixed(0)}%)`
  );
  console.log(`  Output: ${outputDir}`);
}

function fmt(bytes) {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + "KB";
  return (bytes / 1024 / 1024).toFixed(1) + "MB";
}

main();
