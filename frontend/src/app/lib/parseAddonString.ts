export interface ParsedItem {
  slot: string;
  simc_string: string;
  item_id: number;
  ilevel: number;
  name: string;
  bonus_ids: number[];
  enchant_id: number;
  gem_id: number;
  is_equipped: boolean;
}

export type ItemsBySlot = Record<string, ParsedItem[]>;

export const GEAR_SLOTS = [
  "head", "neck", "shoulder", "back", "chest", "wrist",
  "hands", "waist", "legs", "feet", "finger1", "finger2",
  "trinket1", "trinket2", "main_hand", "off_hand",
];

export const SLOT_LABELS: Record<string, string> = {
  head: "Head", neck: "Neck", shoulder: "Shoulder",
  back: "Back", chest: "Chest", wrist: "Wrist",
  hands: "Hands", waist: "Waist", legs: "Legs",
  feet: "Feet", finger1: "Ring 1", finger2: "Ring 2",
  trinket1: "Trinket 1", trinket2: "Trinket 2",
  main_hand: "Main Hand", off_hand: "Off Hand",
};

const SLOT_REGEX = new RegExp(
  `^(${GEAR_SLOTS.join("|")})=(.*)`, "i"
);

// Bag items for these slots should appear in both paired slots
const PAIRED_SLOTS: Record<string, string> = {
  finger1: "finger2",
  finger2: "finger1",
  trinket1: "trinket2",
  trinket2: "trinket1",
};

function parseItemProps(itemStr: string): Omit<ParsedItem, "slot" | "is_equipped" | "simc_string"> {
  const idMatch = itemStr.match(/,id=(\d+)/);
  const ilvlMatch = itemStr.match(/(?:ilevel|ilvl)=(\d+)/);
  const nameMatch = itemStr.match(/name=([^,]+)/);
  const encMatch = itemStr.match(/^([a-z_]+),/);
  const bonusMatch = itemStr.match(/bonus_id=([0-9/:]+)/);
  const enchantMatch = itemStr.match(/enchant_id=(\d+)/);
  const gemMatch = itemStr.match(/gem_id=(\d+)/);

  let name = "";
  if (nameMatch) {
    name = nameMatch[1].replace(/_/g, " ");
  } else if (encMatch) {
    name = encMatch[1].replace(/_/g, " ");
  }
  name = name.replace(/\b\w/g, (c) => c.toUpperCase());

  const bonus_ids = bonusMatch
    ? bonusMatch[1].split(/[/:]/).map(Number).filter(Boolean)
    : [];

  return {
    item_id: idMatch ? parseInt(idMatch[1]) : 0,
    ilevel: ilvlMatch ? parseInt(ilvlMatch[1]) : 0,
    name,
    bonus_ids,
    enchant_id: enchantMatch ? parseInt(enchantMatch[1]) : 0,
    gem_id: gemMatch ? parseInt(gemMatch[1]) : 0,
  };
}

// Matches comment lines like "# Emberwing Feather (246)"
const ITEM_HEADER_REGEX = /^#+\s*(.+?)\s*\((\d+)\)\s*$/;

export function parseAddonString(simcInput: string): ItemsBySlot {
  const equipped: Record<string, ParsedItem> = {};
  const bagItems: Record<string, ParsedItem[]> = {};

  // Track the last "# Name (ilvl)" header line
  let pendingName = "";
  let pendingIlevel = 0;

  for (const rawLine of simcInput.split("\n")) {
    const stripped = rawLine.trim();

    if (stripped.startsWith("#")) {
      const clean = stripped.replace(/^#+\s*/, "");
      const m = clean.match(SLOT_REGEX);
      if (m) {
        const slot = m[1].toLowerCase();
        const itemStr = m[2];
        const props = parseItemProps(itemStr);
        // Use pending header data if the item line didn't have name/ilvl
        if (!props.name && pendingName) props.name = pendingName;
        if (!props.ilevel && pendingIlevel) props.ilevel = pendingIlevel;
        pendingName = "";
        pendingIlevel = 0;
        const entry: ParsedItem = {
          slot,
          simc_string: itemStr,
          is_equipped: false,
          ...props,
        };
        if (!bagItems[slot]) bagItems[slot] = [];
        bagItems[slot].push(entry);

        // Rings/trinkets: also add to the paired slot
        const other = PAIRED_SLOTS[slot];
        if (other) {
          if (!bagItems[other]) bagItems[other] = [];
          bagItems[other].push({ ...entry, slot: other });
        }
      } else {
        // Check if this is a "# Name (ilvl)" header
        const headerMatch = stripped.match(ITEM_HEADER_REGEX);
        if (headerMatch) {
          pendingName = headerMatch[1];
          pendingIlevel = parseInt(headerMatch[2]);
        } else {
          pendingName = "";
          pendingIlevel = 0;
        }
      }
    } else {
      const m = stripped.match(SLOT_REGEX);
      if (m) {
        const slot = m[1].toLowerCase();
        const itemStr = m[2];
        const props = parseItemProps(itemStr);
        if (!props.name && pendingName) props.name = pendingName;
        if (!props.ilevel && pendingIlevel) props.ilevel = pendingIlevel;
        pendingName = "";
        pendingIlevel = 0;
        equipped[slot] = {
          slot,
          simc_string: itemStr,
          is_equipped: true,
          ...props,
        };
      }
    }
  }

  // Build items_by_slot: equipped first, then bag items (deduplicated)
  const itemsBySlot: ItemsBySlot = {};
  for (const slot of GEAR_SLOTS) {
    const items: ParsedItem[] = [];
    const seenIds = new Set<number>();

    if (equipped[slot]) {
      items.push(equipped[slot]);
      if (equipped[slot].item_id) seenIds.add(equipped[slot].item_id);
    }

    if (bagItems[slot]) {
      for (const bagItem of bagItems[slot]) {
        const iid = bagItem.item_id;
        if (iid && seenIds.has(iid)) continue;
        if (iid) seenIds.add(iid);
        items.push(bagItem);
      }
    }

    if (items.length > 0) {
      itemsBySlot[slot] = items;
    }
  }

  return itemsBySlot;
}
