const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVehicleOptions,
  findServices,
  findResult,
  calculateEstimate,
  formatPrice,
  formatDuration,
  normalizeRows,
} = require('../src/calculator');

const rows = [
  {
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    service: 'Замена масла',
    service_group: 'ТО',
    synonyms: ['масло', 'моторное масло'],
    price: 3500,
    duration_min: 40,
    comment: 'Масло не включено',
    status: 'active',
    updated_at: '2026-05',
  },
  {
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    service: 'Диагностика подвески',
    service_group: 'Диагностика',
    synonyms: ['ходовая', 'стук'],
    price: 1800,
    duration_min: 45,
    comment: '',
    status: 'check',
    updated_at: '2026-05',
  },
  {
    brand: 'Toyota',
    model: 'RAV4',
    year: 2022,
    service: 'Замена масла',
    service_group: 'ТО',
    synonyms: ['масло'],
    price: 3900,
    duration_min: 45,
    comment: '',
    status: 'active',
    updated_at: '2026-05',
  },
  {
    brand: 'Hyundai',
    model: 'Solaris',
    year: 2020,
    service: 'Замена передних колодок',
    service_group: 'Тормоза',
    synonyms: ['тормоза', 'колодки'],
    price: 2600,
    duration_min: 50,
    comment: 'Запчасти отдельно',
    status: 'hidden',
    updated_at: '2026-05',
  },
];

test('normalizes numeric fields and excludes hidden rows', () => {
  const normalized = normalizeRows(rows);

  assert.equal(normalized.length, 3);
  assert.deepEqual(
    normalized.map((row) => row.service),
    ['Замена масла', 'Диагностика подвески', 'Замена масла'],
  );
});

test('builds cascading vehicle options from active rows', () => {
  const normalized = normalizeRows(rows);

  assert.deepEqual(buildVehicleOptions(normalized), {
    brands: ['Toyota'],
    models: [],
    years: [],
  });

  assert.deepEqual(buildVehicleOptions(normalized, { brand: 'Toyota' }), {
    brands: ['Toyota'],
    models: ['Camry', 'RAV4'],
    years: [],
  });

  assert.deepEqual(buildVehicleOptions(normalized, { brand: 'Toyota', model: 'Camry' }), {
    brands: ['Toyota'],
    models: ['Camry', 'RAV4'],
    years: [2021],
  });
});

test('finds services by selected vehicle and synonyms', () => {
  const normalized = normalizeRows(rows);
  const found = findServices(normalized, {
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    query: 'ходовая',
  });

  assert.equal(found.length, 1);
  assert.equal(found[0].service, 'Диагностика подвески');
  assert.equal(found[0].status, 'check');
});

test('keeps known services selectable so missing vehicle prices can be shown', () => {
  const normalized = normalizeRows(rows);
  const found = findServices(normalized, {
    brand: 'Toyota',
    model: 'RAV4',
    year: 2022,
    query: 'ходовая',
  });

  assert.equal(found.length, 1);
  assert.equal(found[0].service, 'Диагностика подвески');
});

test('returns exact result for vehicle and service selection', () => {
  const normalized = normalizeRows(rows);
  const result = findResult(normalized, {
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    service: 'Замена масла',
  });

  assert.equal(result.price, 3500);
  assert.equal(result.duration_min, 40);
  assert.equal(result.comment, 'Масло не включено');
});

test('returns null when selected combination has no data', () => {
  const normalized = normalizeRows(rows);
  const result = findResult(normalized, {
    brand: 'Toyota',
    model: 'RAV4',
    year: 2022,
    service: 'Диагностика подвески',
  });

  assert.equal(result, null);
});

test('calculates totals by found services and reports missing selected services', () => {
  const normalized = normalizeRows(rows);
  const estimate = calculateEstimate(normalized, {
    brand: 'Toyota',
    model: 'RAV4',
    year: 2022,
    services: ['Замена масла', 'Диагностика подвески'],
  });

  assert.equal(estimate.totalPrice, 3900);
  assert.equal(estimate.totalDurationMin, 45);
  assert.equal(estimate.items.length, 2);
  assert.equal(estimate.items[0].status, 'found');
  assert.equal(estimate.items[1].status, 'missing');
  assert.deepEqual(estimate.missingServices, ['Диагностика подвески']);
});

test('marks estimate as needing confirmation when any found service has check status', () => {
  const normalized = normalizeRows(rows);
  const estimate = calculateEstimate(normalized, {
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    services: ['Замена масла', 'Диагностика подвески'],
  });

  assert.equal(estimate.totalPrice, 5300);
  assert.equal(estimate.totalDurationMin, 85);
  assert.equal(estimate.needsCheck, true);
});

test('formats price and duration for operator display', () => {
  assert.equal(formatPrice(3500), '3 500 ₽');
  assert.equal(formatDuration(0), '0 мин');
  assert.equal(formatDuration(75), '1 ч 15 мин');
  assert.equal(formatDuration(40), '40 мин');
});
