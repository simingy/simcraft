use once_cell::sync::OnceCell;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

static ITEMS: OnceCell<HashMap<u64, Value>> = OnceCell::new();
static ENCHANTS: OnceCell<HashMap<u64, Value>> = OnceCell::new();
static ENCHANTS_BY_ITEM_ID: OnceCell<HashMap<u64, Value>> = OnceCell::new();
static BONUSES: OnceCell<HashMap<u64, Value>> = OnceCell::new();
static UPGRADE_MAX: OnceCell<HashMap<u64, u64>> = OnceCell::new();

pub fn load(data_dir: &Path) {
    // equippable-items-full.json — array of {id, name, icon, quality, itemLevel, ...}
    let items_path = data_dir.join("equippable-items-full.json");
    if items_path.exists() {
        let data: Vec<Value> = serde_json::from_reader(
            std::io::BufReader::new(fs::File::open(&items_path).unwrap()),
        )
        .unwrap_or_default();
        let map: HashMap<u64, Value> = data
            .into_iter()
            .filter_map(|v| {
                let id = v.get("id")?.as_u64()?;
                Some((id, v))
            })
            .collect();
        println!("Loaded {} items", map.len());
        let _ = ITEMS.set(map);
    }

    // enchantments.json — array of {id, displayName, ...}
    let enchants_path = data_dir.join("enchantments.json");
    if enchants_path.exists() {
        let data: Vec<Value> = serde_json::from_reader(
            std::io::BufReader::new(fs::File::open(&enchants_path).unwrap()),
        )
        .unwrap_or_default();
        let by_id: HashMap<u64, Value> = data
            .iter()
            .filter_map(|v| {
                let id = v.get("id")?.as_u64()?;
                Some((id, v.clone()))
            })
            .collect();
        let by_item_id: HashMap<u64, Value> = data
            .into_iter()
            .filter_map(|v| {
                let item_id = v.get("itemId")?.as_u64()?;
                Some((item_id, v))
            })
            .collect();
        println!("Loaded {} enchants", by_id.len());
        let _ = ENCHANTS.set(by_id);
        let _ = ENCHANTS_BY_ITEM_ID.set(by_item_id);
    }

    // bonuses.json — object keyed by bonus ID string
    let bonuses_path = data_dir.join("bonuses.json");
    if bonuses_path.exists() {
        let raw: HashMap<String, Value> = serde_json::from_reader(
            std::io::BufReader::new(fs::File::open(&bonuses_path).unwrap()),
        )
        .unwrap_or_default();
        let map: HashMap<u64, Value> = raw
            .into_iter()
            .filter_map(|(k, v)| {
                let id = k.parse::<u64>().ok()?;
                Some((id, v))
            })
            .collect();

        // Build upgrade group index
        let mut groups: HashMap<u64, Vec<(u64, u64)>> = HashMap::new(); // group -> [(bonus_id, level)]
        for (bid, bonus) in &map {
            if let Some(upgrade) = bonus.get("upgrade") {
                if let (Some(group), Some(level)) =
                    (upgrade.get("group").and_then(|g| g.as_u64()),
                     upgrade.get("level").and_then(|l| l.as_u64()))
                {
                    groups.entry(group).or_default().push((*bid, level));
                }
            }
        }
        let mut upgrade_max: HashMap<u64, u64> = HashMap::new();
        for members in groups.values() {
            let max_bonus_id = members
                .iter()
                .max_by_key(|(_, level)| *level)
                .map(|(id, _)| *id)
                .unwrap_or(0);
            for (bid, _) in members {
                upgrade_max.insert(*bid, max_bonus_id);
            }
        }
        println!("Loaded {} bonuses, {} upgrade groups", map.len(), groups.len());
        let _ = BONUSES.set(map);
        let _ = UPGRADE_MAX.set(upgrade_max);
    }
}

fn items() -> &'static HashMap<u64, Value> {
    ITEMS.get().expect("Game data not loaded")
}

fn enchants() -> &'static HashMap<u64, Value> {
    ENCHANTS.get().expect("Game data not loaded")
}

fn enchants_by_item_id() -> &'static HashMap<u64, Value> {
    ENCHANTS_BY_ITEM_ID.get().expect("Game data not loaded")
}

fn bonuses() -> &'static HashMap<u64, Value> {
    BONUSES.get().expect("Game data not loaded")
}

fn upgrade_max() -> &'static HashMap<u64, u64> {
    UPGRADE_MAX.get().expect("Game data not loaded")
}

pub const QUALITY_NAMES: &[(u64, &str)] = &[
    (0, "poor"),
    (1, "common"),
    (2, "uncommon"),
    (3, "rare"),
    (4, "epic"),
    (5, "legendary"),
    (6, "artifact"),
    (7, "heirloom"),
];

pub fn quality_name(quality: u64) -> &'static str {
    QUALITY_NAMES
        .iter()
        .find(|(q, _)| *q == quality)
        .map(|(_, name)| *name)
        .unwrap_or("common")
}

fn resolve_bonuses(bonus_ids: &[u64]) -> Value {
    let mut result = serde_json::json!({});
    for bid in bonus_ids {
        if let Some(bonus) = bonuses().get(bid) {
            if let Some(q) = bonus.get("quality") {
                result["quality"] = q.clone();
            }
            if let Some(il) = bonus.get("itemLevel").and_then(|il| il.get("amount")) {
                result["ilevel"] = il.clone();
            }
            if let Some(tag) = bonus.get("tag") {
                result["tag"] = tag.clone();
            }
            if let Some(socket) = bonus.get("socket") {
                result["sockets"] = socket.clone();
            }
            if let Some(upgrade) = bonus.get("upgrade").and_then(|u| u.get("fullName")) {
                result["upgrade"] = upgrade.clone();
            }
        }
    }
    result
}

pub fn get_item_info(item_id: u64, bonus_ids: Option<&[u64]>) -> Option<Value> {
    let item = items().get(&item_id)?;

    let mut quality = item.get("quality").and_then(|q| q.as_u64()).unwrap_or(1);
    let mut ilevel = item.get("itemLevel").and_then(|i| i.as_u64()).unwrap_or(0);
    let mut tag = String::new();
    let mut sockets: u64 = 0;
    let mut upgrade = String::new();

    if let Some(bids) = bonus_ids {
        let resolved = resolve_bonuses(bids);
        if let Some(q) = resolved.get("quality").and_then(|q| q.as_u64()) {
            quality = q;
        }
        if let Some(i) = resolved.get("ilevel").and_then(|i| i.as_u64()) {
            ilevel = i;
        }
        if let Some(t) = resolved.get("tag").and_then(|t| t.as_str()) {
            tag = t.to_string();
        }
        if let Some(s) = resolved.get("sockets").and_then(|s| s.as_u64()) {
            sockets = s;
        }
        if let Some(u) = resolved.get("upgrade").and_then(|u| u.as_str()) {
            upgrade = u.to_string();
        }
    }

    let armor_subclass = if item.get("itemClass").and_then(|c| c.as_u64()) == Some(4) {
        item.get("itemSubClass").and_then(|s| s.as_u64()).unwrap_or(0)
    } else {
        0
    };

    Some(serde_json::json!({
        "item_id": item_id,
        "name": item.get("name").and_then(|n| n.as_str()).unwrap_or("Unknown"),
        "quality": quality,
        "quality_name": quality_name(quality),
        "icon": item.get("icon").and_then(|i| i.as_str()).unwrap_or("inv_misc_questionmark"),
        "ilevel": ilevel,
        "tag": tag,
        "sockets": sockets,
        "upgrade": upgrade,
        "armor_subclass": armor_subclass,
    }))
}

pub fn get_enchant_info(enchant_id: u64) -> Option<Value> {
    let enchant = enchants().get(&enchant_id)?;
    let name = enchant
        .get("itemName")
        .or_else(|| enchant.get("displayName"))
        .and_then(|n| n.as_str())
        .unwrap_or("");
    Some(serde_json::json!({
        "enchant_id": enchant_id,
        "name": name,
    }))
}

pub fn get_gem_info(gem_item_id: u64) -> Option<Value> {
    let gem = enchants_by_item_id().get(&gem_item_id)?;
    let name = gem
        .get("itemName")
        .or_else(|| gem.get("displayName"))
        .and_then(|n| n.as_str())
        .unwrap_or("");
    let icon = gem
        .get("itemIcon")
        .or_else(|| gem.get("spellIcon"))
        .and_then(|i| i.as_str())
        .unwrap_or("");
    let quality = gem.get("quality").and_then(|q| q.as_u64()).unwrap_or(3);
    Some(serde_json::json!({
        "gem_id": gem_item_id,
        "name": name,
        "icon": icon,
        "quality": quality,
    }))
}

/// Returns the item's armor subclass: 0=Misc, 1=Cloth, 2=Leather, 3=Mail, 4=Plate.
/// Returns None if the item is not found or is not armor (itemClass != 4).
pub fn get_item_armor_subclass(item_id: u64) -> Option<u64> {
    let item = items().get(&item_id)?;
    let item_class = item.get("itemClass")?.as_u64()?;
    if item_class != 4 {
        return None; // Not armor
    }
    item.get("itemSubClass")?.as_u64()
}

pub fn get_upgrade_options(bonus_ids: &[u64]) -> Option<Vec<Value>> {
    let um = upgrade_max();
    for bid in bonus_ids {
        if um.contains_key(bid) {
            let bonus = bonuses().get(bid)?;
            let group_id = bonus.get("upgrade")?.get("group")?.as_u64()?;
            let mut members: Vec<&Value> = bonuses()
                .values()
                .filter(|b| {
                    b.get("upgrade")
                        .and_then(|u| u.get("group"))
                        .and_then(|g| g.as_u64())
                        == Some(group_id)
                })
                .collect();
            members.sort_by_key(|b| {
                b.get("upgrade")
                    .and_then(|u| u.get("level"))
                    .and_then(|l| l.as_u64())
                    .unwrap_or(0)
            });
            return Some(
                members
                    .into_iter()
                    .filter_map(|b| {
                        let u = b.get("upgrade")?;
                        Some(serde_json::json!({
                            "bonus_id": b.get("id")?.as_u64()?,
                            "level": u.get("level")?.as_u64()?,
                            "max": u.get("max")?.as_u64()?,
                            "name": u.get("name")?.as_str()?,
                            "fullName": u.get("fullName")?.as_str()?,
                            "itemLevel": u.get("itemLevel")?.as_u64()?,
                        }))
                    })
                    .collect(),
            );
        }
    }
    None
}

pub fn upgrade_bonus_ids_to_max(bonus_ids: &[u64]) -> Vec<u64> {
    let um = upgrade_max();
    bonus_ids
        .iter()
        .map(|bid| *um.get(bid).unwrap_or(bid))
        .collect()
}

pub fn upgrade_simc_input(simc_input: &str) -> String {
    let re = regex::Regex::new(r"bonus_id=([0-9/:]+)").unwrap();
    re.replace_all(simc_input, |caps: &regex::Captures| {
        let raw = &caps[1];
        let sep = if raw.contains('/') { "/" } else { ":" };
        let ids: Vec<u64> = raw
            .split(&['/', ':'][..])
            .filter_map(|s| s.parse().ok())
            .collect();
        let upgraded = upgrade_bonus_ids_to_max(&ids);
        format!(
            "bonus_id={}",
            upgraded
                .iter()
                .map(|id| id.to_string())
                .collect::<Vec<_>>()
                .join(sep)
        )
    })
    .to_string()
}

pub fn upgrade_items_by_slot(
    items_by_slot: &HashMap<String, Vec<Value>>,
) -> HashMap<String, Vec<Value>> {
    let bonus_re = regex::Regex::new(r"bonus_id=([0-9/:]+)").unwrap();
    let mut result = HashMap::new();

    for (slot, items) in items_by_slot {
        let new_items: Vec<Value> = items
            .iter()
            .map(|item| {
                let old_bonus_ids: Vec<u64> = item
                    .get("bonus_ids")
                    .and_then(|b| b.as_array())
                    .map(|arr| arr.iter().filter_map(|v| v.as_u64()).collect())
                    .unwrap_or_default();

                let new_bonus_ids = upgrade_bonus_ids_to_max(&old_bonus_ids);

                if new_bonus_ids == old_bonus_ids {
                    return item.clone();
                }

                let mut updated = item.clone();
                updated["bonus_ids"] = serde_json::json!(new_bonus_ids);

                // Update simc_string with new bonus_ids
                if let Some(simc) = item.get("simc_string").and_then(|s| s.as_str()) {
                    let new_simc = bonus_re.replace(simc, |caps: &regex::Captures| {
                        let raw = &caps[1];
                        let sep = if raw.contains('/') { "/" } else { ":" };
                        format!(
                            "bonus_id={}",
                            new_bonus_ids
                                .iter()
                                .map(|id| id.to_string())
                                .collect::<Vec<_>>()
                                .join(sep)
                        )
                    }).to_string();
                    updated["simc_string"] = serde_json::json!(new_simc);
                }

                // Recalculate ilevel from base item + new bonuses
                let item_id = item.get("item_id").and_then(|v| v.as_u64()).unwrap_or(0);
                let items_map = self::items();
                if let Some(base_item) = items_map.get(&item_id) {
                    let base_ilevel = base_item.get("itemLevel").and_then(|v: &Value| v.as_u64()).unwrap_or(0);
                    let resolved = resolve_bonuses(&new_bonus_ids);
                    let new_ilevel = resolved.get("ilevel").and_then(|v: &Value| v.as_u64()).unwrap_or(base_ilevel);
                    updated["ilevel"] = serde_json::json!(new_ilevel);
                }

                updated
            })
            .collect();
        result.insert(slot.clone(), new_items);
    }
    result
}

pub fn apply_copy_enchants(
    items_by_slot: &HashMap<String, Vec<Value>>,
) -> HashMap<String, Vec<Value>> {
    let re = regex::Regex::new(r"enchant_id=\d+").unwrap();
    let id_re = regex::Regex::new(r"(,id=\d+)").unwrap();
    let mut result = HashMap::new();

    for (slot, items) in items_by_slot {
        let equipped = items.iter().find(|it| {
            it.get("is_equipped")
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        });
        let ench_id = equipped
            .and_then(|e| e.get("enchant_id"))
            .and_then(|e| e.as_u64())
            .unwrap_or(0);

        if ench_id == 0 {
            result.insert(slot.clone(), items.clone());
            continue;
        }

        let new_items: Vec<Value> = items
            .iter()
            .map(|item| {
                let is_equipped = item
                    .get("is_equipped")
                    .and_then(|v| v.as_bool())
                    .unwrap_or(false);
                let current_ench = item
                    .get("enchant_id")
                    .and_then(|e| e.as_u64())
                    .unwrap_or(0);

                if is_equipped || current_ench == ench_id {
                    return item.clone();
                }

                let mut updated = item.clone();
                updated["enchant_id"] = serde_json::json!(ench_id);

                if let Some(simc) = item.get("simc_string").and_then(|s| s.as_str()) {
                    let new_simc = if re.is_match(simc) {
                        re.replace(simc, &format!("enchant_id={}", ench_id))
                            .to_string()
                    } else {
                        id_re
                            .replace(simc, &format!("$1,enchant_id={}", ench_id))
                            .to_string()
                    };
                    updated["simc_string"] = serde_json::json!(new_simc);
                }

                updated
            })
            .collect();
        result.insert(slot.clone(), new_items);
    }
    result
}
