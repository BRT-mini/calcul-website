const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  convertCsvToRows,
  parseCsv,
  validateRows,
  writeJson,
} = require('../scripts/convert-services');

test('parses quoted CSV values and semicolon synonyms', () => {
  const csv = [
    'brand,model,year,service,service_group,synonyms,price,duration_min,comment,status,updated_at',
    'Toyota,Camry,2021,"Замена масла",ТО,"масло; моторное масло",3500,40,"Масло не включено",active,2026-05',
  ].join('\n');

  const rows = parseCsv(csv);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].service, 'Замена масла');
  assert.equal(rows[0].synonyms, 'масло; моторное масло');
});

test('validates required fields, numeric fields, statuses, and hides hidden rows', () => {
  const rows = convertCsvToRows([
    'brand,model,year,service,service_group,synonyms,price,duration_min,comment,status,updated_at',
    'Toyota,Camry,2021,Замена масла,ТО,масло,3500,40,,active,2026-05',
    'Toyota,Camry,2021,Старая услуга,ТО,,1000,30,,hidden,2026-05',
  ].join('\n'));

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    brand: 'Toyota',
    model: 'Camry',
    year: 2021,
    service: 'Замена масла',
    service_group: 'ТО',
    synonyms: ['масло'],
    price: 3500,
    duration_min: 40,
    comment: '',
    status: 'active',
    updated_at: '2026-05',
  });
});

test('reports validation errors with row numbers', () => {
  const rows = parseCsv([
    'brand,model,year,service,price,duration_min,status',
    'Toyota,Camry,year,Замена масла,3500,40,active',
    'Toyota,Camry,2021,Диагностика,,40,wrong',
  ].join('\n'));

  const errors = validateRows(rows);

  assert.deepEqual(errors, [
    'Row 2: year must be a concrete number',
    'Row 3: price is required',
    'Row 3: status must be one of active, check, hidden',
  ]);
});

test('writes formatted JSON file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoservice-'));
  const target = path.join(dir, 'services.json');

  writeJson(target, [
    {
      brand: 'Toyota',
      model: 'Camry',
      year: 2021,
      service: 'Замена масла',
      service_group: 'ТО',
      synonyms: ['масло'],
      price: 3500,
      duration_min: 40,
      comment: '',
      status: 'active',
      updated_at: '2026-05',
    },
  ]);

  const saved = JSON.parse(fs.readFileSync(target, 'utf8'));
  assert.equal(saved.version, '2026-05');
  assert.equal(saved.services.length, 1);
  assert.equal(saved.services[0].price, 3500);
});
