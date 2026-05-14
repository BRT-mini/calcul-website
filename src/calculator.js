(function attachCalculator(root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AutoServiceCalculator = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCalculator() {
  const VALID_STATUSES = new Set(['active', 'check', 'hidden']);

  function asList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item).trim()).filter(Boolean);
    }

    return String(value || '')
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function sortText(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  }

  function normalizeRows(rows) {
    return rows
      .map((row) => {
        const status = String(row.status || 'active').trim().toLowerCase();

        return {
          brand: String(row.brand || '').trim(),
          model: String(row.model || '').trim(),
          year: Number(row.year),
          service: String(row.service || '').trim(),
          service_group: String(row.service_group || '').trim(),
          synonyms: asList(row.synonyms),
          price: Number(row.price),
          duration_min: Number(row.duration_min),
          comment: String(row.comment || '').trim(),
          status: VALID_STATUSES.has(status) ? status : 'check',
          updated_at: String(row.updated_at || '').trim(),
        };
      })
      .filter((row) => row.status !== 'hidden');
  }

  function buildVehicleOptions(rows, selection = {}) {
    const brands = sortText(rows.map((row) => row.brand));
    const byBrand = selection.brand ? rows.filter((row) => row.brand === selection.brand) : [];
    const byModel = selection.model
      ? byBrand.filter((row) => row.model === selection.model)
      : [];

    return {
      brands,
      models: sortText(byBrand.map((row) => row.model)),
      years: [...new Set(byModel.map((row) => row.year))]
        .filter((year) => Number.isFinite(year))
        .sort((a, b) => b - a),
    };
  }

  function hasVehicle(row, selection) {
    return (
      row.brand === selection.brand &&
      row.model === selection.model &&
      Number(row.year) === Number(selection.year)
    );
  }

  function matchesQuery(row, query) {
    const normalized = normalizeText(query);
    if (!normalized) {
      return true;
    }

    const haystack = [
      row.service,
      row.service_group,
      ...row.synonyms,
    ].map(normalizeText);

    return haystack.some((value) => value.includes(normalized));
  }

  function findServices(rows, selection = {}) {
    if (!selection.brand || !selection.model || !selection.year) {
      return [];
    }

    const matches = rows.filter((row) => matchesQuery(row, selection.query));
    const seen = new Set();

    return matches.filter((row) => {
      const key = row.service;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function findResult(rows, selection = {}) {
    if (!selection.brand || !selection.model || !selection.year || !selection.service) {
      return null;
    }

    return rows.find((row) => hasVehicle(row, selection) && row.service === selection.service) || null;
  }

  function calculateEstimate(rows, selection = {}) {
    const services = Array.isArray(selection.services) ? selection.services : [];
    const items = services.map((service) => {
      const result = findResult(rows, { ...selection, service });

      if (!result) {
        return {
          service,
          status: 'missing',
          result: null,
        };
      }

      return {
        service,
        status: 'found',
        result,
      };
    });

    const found = items.filter((item) => item.result);

    return {
      items,
      totalPrice: found.reduce((total, item) => total + item.result.price, 0),
      totalDurationMin: found.reduce((total, item) => total + item.result.duration_min, 0),
      missingServices: items.filter((item) => item.status === 'missing').map((item) => item.service),
      needsCheck: found.some((item) => item.result.status === 'check'),
    };
  }

  function formatPrice(price) {
    return `${Number(price).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')} ₽`;
  }

  function formatDuration(minutes) {
    const total = Number(minutes);
    if (!Number.isFinite(total) || total < 0) {
      return 'не указано';
    }
    if (total === 0) {
      return '0 мин';
    }

    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (!hours) {
      return `${rest} мин`;
    }
    if (!rest) {
      return `${hours} ч`;
    }
    return `${hours} ч ${rest} мин`;
  }

  return {
    VALID_STATUSES,
    buildVehicleOptions,
    calculateEstimate,
    findResult,
    findServices,
    formatDuration,
    formatPrice,
    normalizeRows,
    normalizeText,
  };
});
