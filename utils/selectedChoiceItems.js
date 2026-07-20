/** Resolve option UID (255-…) from a choice option object. */
function resolveOptionBsoUid(opt) {
  if (!opt || typeof opt !== "object") return "";
  return String(opt.bso_uid || opt.id || opt.option_uid || opt.bsoUid || "").trim();
}

/** Normalize one selected_choice_items row for API / display. */
function normalizeChoiceItemRow(item) {
  if (!item || typeof item !== "object") return null;
  const groupTitle = item.groupTitle || item.group_title || "";
  const label = item.label || item.option_label || item.optionLabel || "";
  const bsoUid = String(item.bso_uid || item.id || item.option_uid || item.bsoUid || "").trim();
  const extraCost = parseFloat(item.extra_cost) || 0;
  if (!label && !groupTitle && !bsoUid) return null;
  const row = {
    groupTitle,
    label,
    extra_cost: extraCost,
  };
  if (bsoUid) row.bso_uid = bsoUid;
  return row;
}

/** Build per-option lines (group, label, extra cost, bso_uid) from product choice groups + buyer selections. */
export function buildSelectedChoiceItems(serviceOptions, selectedChoices) {
  const items = [];
  (serviceOptions || []).forEach((group) => {
    const sel = selectedChoices?.[group.title];
    if (!sel) return;
    const selectedIds = Array.isArray(sel) ? sel : [sel];
    (group.options || [])
      .filter((opt) => selectedIds.includes(opt.id) || selectedIds.includes(opt.bso_uid))
      .forEach((opt) => {
        const bsoUid = resolveOptionBsoUid(opt);
        const row = {
          groupTitle: group.title || "",
          label: opt.label || "",
          extra_cost: parseFloat(opt.extra_cost) || 0,
        };
        if (bsoUid) row.bso_uid = bsoUid;
        items.push(row);
      });
  });
  return items;
}

export function sumChoiceExtraCost(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (parseFloat(item.extra_cost) || 0), 0);
}

/**
 * Ensure selected_choice_items has one row per selected option with bso_uid.
 * Rebuilds from selected_choices when stored items are missing UIDs (legacy cart rows).
 */
export function normalizeSelectedChoiceItemsForApi(item) {
  if (!item || typeof item !== "object") {
    return [];
  }

  const selectedChoices = item.selectedChoices || item.selected_choices || {};
  const selectedChoiceLabels = item.selectedChoiceLabels || item.selected_choice_labels || {};
  const rawItems = item.selectedChoiceItems ?? item.selected_choice_items;
  const existingItems = Array.isArray(rawItems) ? rawItems.map(normalizeChoiceItemRow).filter(Boolean) : [];

  const choiceEntries = Object.entries(selectedChoices).filter(([, sel]) => {
    if (sel == null || sel === "") return false;
    if (Array.isArray(sel)) return sel.length > 0;
    return true;
  });

  if (!choiceEntries.length && !existingItems.length) {
    return [];
  }

  // Preferred path: rebuild from selected_choices so every option has its bso_uid.
  if (choiceEntries.length) {
    const rebuilt = [];
    for (const [groupTitle, sel] of choiceEntries) {
      const ids = Array.isArray(sel) ? sel : [sel];
      const labelsForGroup = String(selectedChoiceLabels[groupTitle] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const existingForGroup = existingItems.filter((row) => row.groupTitle === groupTitle);

      ids.forEach((id, idx) => {
        const bsoUid = String(id || "").trim();
        const existing = existingForGroup.find((row) => row.bso_uid === bsoUid) || existingForGroup[idx] || {};
        rebuilt.push({
          groupTitle,
          bso_uid: bsoUid,
          label: existing.label || labelsForGroup[idx] || bsoUid,
          extra_cost: parseFloat(existing.extra_cost) || 0,
        });
      });
    }
    return rebuilt.filter((row) => row.bso_uid);
  }

  // No selected_choices map — keep existing rows that already have bso_uid.
  return existingItems.filter((row) => row.bso_uid);
}

/** Itemized lines for display; falls back to grouped labels when per-option costs were not stored. */
export function getItemizedChoiceLines(data) {
  if (!data || typeof data !== "object") return [];

  const rawSelectedOptions = data.selected_options ?? data.selectedOptions;
  if (Array.isArray(rawSelectedOptions) && rawSelectedOptions.length > 0) {
    return rawSelectedOptions.map(normalizeChoiceItemRow).filter(Boolean);
  }

  const rawItems = data.selectedChoiceItems ?? data.selected_choice_items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    return rawItems.map(normalizeChoiceItemRow).filter(Boolean);
  }
  const labels = data.selectedChoiceLabels || data.selected_choice_labels || {};
  return Object.entries(labels).flatMap(([groupTitle, labelStr]) =>
    String(labelStr)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => ({ groupTitle, label, extra_cost: 0 })),
  );
}

export function formatChoiceLineText(line) {
  const extra = parseFloat(line.extra_cost) || 0;
  const prefix = line.groupTitle ? `${line.groupTitle}: ${line.label}` : line.label;
  return extra > 0 ? `${prefix} (+$${extra.toFixed(2)})` : prefix;
}

export function cartChoiceEnrichmentFromItem(item) {
  if (!item?.bs_uid) return null;
  const selectedChoiceItems = getItemizedChoiceLines(item);
  const hasLegacy =
    item.selectedChoiceLabels ||
    item.choicesExtraCost ||
    item.specialInstructions ||
    selectedChoiceItems.length > 0;
  if (!hasLegacy) return null;
  return {
    choicesExtraCost: item.choicesExtraCost || sumChoiceExtraCost(selectedChoiceItems) || 0,
    selectedChoiceLabels: item.selectedChoiceLabels || {},
    selectedChoiceItems,
    selectedChoices: item.selectedChoices || {},
    specialInstructions: item.specialInstructions || "",
    unitPrice: item.unitPrice,
  };
}
