/** Build per-option lines (group, label, extra cost) from product choice groups + buyer selections. */
export function buildSelectedChoiceItems(serviceOptions, selectedChoices) {
  const items = [];
  (serviceOptions || []).forEach((group) => {
    const sel = selectedChoices?.[group.title];
    if (!sel) return;
    const selectedIds = Array.isArray(sel) ? sel : [sel];
    (group.options || [])
      .filter((opt) => selectedIds.includes(opt.id))
      .forEach((opt) => {
        items.push({
          groupTitle: group.title || "",
          label: opt.label || "",
          extra_cost: parseFloat(opt.extra_cost) || 0,
        });
      });
  });
  return items;
}

export function sumChoiceExtraCost(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (parseFloat(item.extra_cost) || 0), 0);
}

/** Itemized lines for display; falls back to grouped labels when per-option costs were not stored. */
export function getItemizedChoiceLines(data) {
  if (!data || typeof data !== "object") return [];

  const rawSelectedOptions = data.selected_options ?? data.selectedOptions;
  if (Array.isArray(rawSelectedOptions) && rawSelectedOptions.length > 0) {
    return rawSelectedOptions
      .map((opt) => ({
        groupTitle: opt.groupTitle || opt.group_title || "",
        label: opt.label || opt.option_label || opt.optionLabel || "",
        extra_cost: parseFloat(opt.extra_cost) || 0,
      }))
      .filter((line) => line.label || line.groupTitle);
  }

  const rawItems = data.selectedChoiceItems ?? data.selected_choice_items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    return rawItems
      .map((item) => ({
        groupTitle: item.groupTitle || item.group_title || "",
        label: item.label || item.option_label || item.optionLabel || "",
        extra_cost: parseFloat(item.extra_cost) || 0,
      }))
      .filter((line) => line.label || line.groupTitle);
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
