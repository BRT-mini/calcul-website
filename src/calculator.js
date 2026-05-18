(function attachCalculator(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.AutoServiceCalculator = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCalculator() {
  function list(value) {
    if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
    return String(value || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean);
  }

  function normalizeText(value) {
    return String(value || "").trim().toLowerCase();
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ru"));
  }

  function normalizeRows(rows) {
    return rows
      .map((row) => ({
        brand: String(row.brand || "").trim(),
        model: String(row.model || "").trim(),
        year: Number(row.year),
        service: String(row.service || "").trim(),
        service_group: String(row.service_group || "").trim(),
        synonyms: list(row.synonyms),
        price: Number(row.price),
        duration_min: Number(row.duration_min),
        comment: String(row.comment || "").trim(),
        status: String(row.status || "active").trim(),
        updated_at: String(row.updated_at || "").trim(),
      }))
      .filter((row) => row.status !== "hidden");
  }

  function buildVehicleOptions(rows, selection = {}) {
    const byBrand = selection.brand ? rows.filter((row) => row.brand === selection.brand) : [];
    const byModel = selection.model ? byBrand.filter((row) => row.model === selection.model) : [];
    return {
      brands: uniqueSorted(rows.map((row) => row.brand)),
      models: uniqueSorted(byBrand.map((row) => row.model)),
      years: [...new Set(byModel.map((row) => row.year))].sort((a, b) => b - a),
    };
  }

  function sameVehicle(row, selection) {
    return row.brand === selection.brand && row.model === selection.model && Number(row.year) === Number(selection.year);
  }

  function matchesQuery(row, query) {
    const needle = normalizeText(query);
    if (!needle) return true;
    return [row.service, row.service_group, ...row.synonyms].map(normalizeText).some((value) => value.includes(needle));
  }

  function findServices(rows, selection = {}) {
    if (!selection.brand || !selection.model || !selection.year) return [];
    const seen = new Set();
    return rows.filter((row) => matchesQuery(row, selection.query)).filter((row) => {
      if (seen.has(row.service)) return false;
      seen.add(row.service);
      return true;
    });
  }

  function findResult(rows, selection = {}) {
    if (!selection.brand || !selection.model || !selection.year || !selection.service) return null;
    return rows.find((row) => sameVehicle(row, selection) && row.service === selection.service) || null;
  }

  function calculateEstimate(rows, selection = {}) {
    const services = Array.isArray(selection.services) ? selection.services : [];
    const items = services.map((service) => {
      const result = findResult(rows, { ...selection, service });
      return result ? { service, status: "found", result } : { service, status: "missing", result: null };
    });
    const found = items.filter((item) => item.result);
    return {
      items,
      totalPrice: found.reduce((sum, item) => sum + item.result.price, 0),
      totalDurationMin: found.reduce((sum, item) => sum + item.result.duration_min, 0),
      missingServices: items.filter((item) => item.status === "missing").map((item) => item.service),
      needsCheck: found.some((item) => item.result.status === "check"),
    };
  }

  function formatPrice(price) {
    return `${Number(price || 0).toLocaleString("ru-RU").replace(/\u00a0/g, " ")} ₽`;
  }

  function formatDuration(minutes) {
    const total = Number(minutes || 0);
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (!hours) return `${rest} мин`;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }

  return { buildVehicleOptions, calculateEstimate, findResult, findServices, formatDuration, formatPrice, normalizeRows };
});
