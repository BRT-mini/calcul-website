#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_COLUMNS = ['brand', 'model', 'year', 'service', 'price', 'duration_min', 'status'];
const VALID_STATUSES = new Set(['active', 'check', 'hidden']);

function splitCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(content) {
  const lines = String(content)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());

  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line, index) => {
    const cells = splitCsvLine(line);
    const row = { __rowNumber: index + 2 };

    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex] || '';
    });

    return row;
  });
}

function missingColumns(rows) {
  if (rows.length === 0) {
    return [];
  }

  return REQUIRED_COLUMNS.filter((column) => !(column in rows[0]));
}

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value || '').trim()) && Number(value) > 0;
}

function validateRows(rows) {
  const errors = [];
  const missing = missingColumns(rows);

  missing.forEach((column) => {
    errors.push(`Header: ${column} column is required`);
  });

  rows.forEach((row) => {
    const rowNumber = row.__rowNumber;

    REQUIRED_COLUMNS.forEach((column) => {
      if (!(column in row)) {
        return;
      }
      if (!String(row[column] || '').trim()) {
        errors.push(`Row ${rowNumber}: ${column} is required`);
      }
    });

    if ('year' in row && row.year && !isPositiveInteger(row.year)) {
      errors.push(`Row ${rowNumber}: year must be a concrete number`);
    }
    if ('price' in row && row.price && !isPositiveInteger(row.price)) {
      errors.push(`Row ${rowNumber}: price must be a concrete number`);
    }
    if ('duration_min' in row && row.duration_min && !isPositiveInteger(row.duration_min)) {
      errors.push(`Row ${rowNumber}: duration_min must be a concrete number`);
    }
    if ('status' in row && row.status && !VALID_STATUSES.has(String(row.status).trim())) {
      errors.push(`Row ${rowNumber}: status must be one of active, check, hidden`);
    }
  });

  return errors;
}

function splitSynonyms(value) {
  return String(value || '')
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function convertCsvToRows(content) {
  const parsed = parseCsv(content);
  const errors = validateRows(parsed);

  if (errors.length) {
    const error = new Error(`CSV validation failed:\n${errors.join('\n')}`);
    error.validationErrors = errors;
    throw error;
  }

  return parsed
    .map((row) => ({
      brand: row.brand.trim(),
      model: row.model.trim(),
      year: Number(row.year),
      service: row.service.trim(),
      service_group: String(row.service_group || '').trim(),
      synonyms: splitSynonyms(row.synonyms),
      price: Number(row.price),
      duration_min: Number(row.duration_min),
      comment: String(row.comment || '').trim(),
      status: row.status.trim(),
      updated_at: String(row.updated_at || '').trim(),
    }))
    .filter((row) => row.status !== 'hidden');
}

function getVersion(rows) {
  const version = rows.find((row) => row.updated_at)?.updated_at;
  return version || new Date().toISOString().slice(0, 7);
}

function writeJson(target, rows) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    `${JSON.stringify({ version: getVersion(rows), services: rows }, null, 2)}\n`,
    'utf8',
  );
}

function main() {
  const source = process.argv[2] || path.join(__dirname, '..', 'data', 'services-template.csv');
  const target = process.argv[3] || path.join(__dirname, '..', 'data', 'services.json');
  const rows = convertCsvToRows(fs.readFileSync(source, 'utf8'));

  writeJson(target, rows);
  process.stdout.write(`Converted ${rows.length} visible rows to ${target}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

module.exports = {
  convertCsvToRows,
  parseCsv,
  validateRows,
  writeJson,
};
