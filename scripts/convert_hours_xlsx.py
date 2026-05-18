#!/usr/bin/env python3

import argparse
import json
import re
import sys
import zipfile
from collections import OrderedDict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from xml.etree import ElementTree as ET


SPREADSHEET_NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MULTI_WORD_BRANDS = (
    "ALFA ROMEO",
    "ASTON MARTIN",
    "GREAT WALL",
    "LAND ROVER",
    "ROLLS ROYCE",
)


def parse_model_name(value):
    source = " ".join(str(value or "").strip().split())
    upper = source.upper()

    for brand in MULTI_WORD_BRANDS:
        if upper == brand or upper.startswith(f"{brand} "):
            return brand, source[len(brand) :].strip()

    parts = source.split(" ", 1)
    if len(parts) == 1:
        return parts[0].upper(), parts[0].upper()

    return parts[0].upper(), parts[1].strip()


def parse_decimal(value, label):
    try:
        parsed = Decimal(str(value).replace(",", ".").strip())
    except (InvalidOperation, ValueError) as error:
        raise ValueError(f"{label} must be a number: {value}") from error

    if parsed <= 0:
        raise ValueError(f"{label} must be greater than zero: {value}")

    return parsed


def rounded_int(value):
    return int(Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def format_decimal(value):
    normalized = value.normalize()
    return format(normalized, "f")


def service_group(service):
    return str(service or "").strip().split(" ", 1)[0]


def cell_column_index(ref):
    letters = "".join(char for char in ref if char.isalpha())
    index = 0
    for char in letters:
        index = index * 26 + ord(char.upper()) - 64
    return index - 1


def load_shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    strings = []
    for item in root.findall("a:si", SPREADSHEET_NS):
        strings.append("".join(text.text or "" for text in item.findall(".//a:t", SPREADSHEET_NS)).strip())
    return strings


def cell_value(cell, shared_strings):
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(text.text or "" for text in cell.findall(".//a:t", SPREADSHEET_NS)).strip()

    value = cell.find("a:v", SPREADSHEET_NS)
    if value is None:
        return ""

    raw = value.text or ""
    if cell_type == "s" and raw:
        return shared_strings[int(raw)].strip()
    return raw.strip()


def read_xlsx_rows(path):
    try:
        archive = zipfile.ZipFile(path)
    except zipfile.BadZipFile as error:
        raise ValueError("File is not an OOXML Excel workbook. Save it as .xlsx and try again.") from error

    shared_strings = load_shared_strings(archive)
    sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows = []
    header_seen = False

    for row in sheet.findall(".//a:sheetData/a:row", SPREADSHEET_NS):
        values = ["", "", "", ""]
        for cell in row.findall("a:c", SPREADSHEET_NS):
            column = cell_column_index(cell.attrib.get("r", "A"))
            if column < len(values):
                values[column] = cell_value(cell, shared_strings)

        if not any(values):
            continue

        if values[:4] == ["Модель", "Год выпуска", "Авторабота", "Количество нч"]:
            header_seen = True
            continue

        if not header_seen:
            continue

        model_name, year, service, hours = values
        rows.append(
            {
                "model_name": model_name,
                "year": year,
                "service": service,
                "hours": hours,
            }
        )

    return rows


def convert_rows(rows, hourly_rate, updated_at):
    rate = parse_decimal(hourly_rate, "hourly_rate")
    concrete_years_by_model = {}
    for row in rows:
        year_text = str(row["year"]).strip()
        if re.fullmatch(r"\d{4}", year_text):
            concrete_years_by_model.setdefault(row["model_name"], set()).add(int(year_text))

    grouped = OrderedDict()

    for index, row in enumerate(rows, start=1):
        brand, model = parse_model_name(row["model_name"])
        year_text = str(row["year"]).strip()
        if year_text == "1":
            years = sorted(concrete_years_by_model.get(row["model_name"], []))
            if not years:
                continue
        elif re.fullmatch(r"\d{4}", year_text):
            years = [int(year_text)]
        else:
            raise ValueError(f"Row {index}: year must be a four-digit number: {row['year']}")

        service = str(row["service"] or "").strip()
        if not brand or not model or not service:
            raise ValueError(f"Row {index}: model, brand, and service are required")

        if not str(row["hours"] or "").strip():
            continue

        try:
            hours = parse_decimal(row["hours"], f"Row {index} hours")
        except ValueError as error:
            if "must be greater than zero" in str(error):
                continue
            raise
        for year in years:
            key = (brand, model, year, service)
            grouped.setdefault(key, []).append(hours)

    converted = []
    for (brand, model, year, service), hours_values in grouped.items():
        unique_hours = sorted(set(hours_values))
        chosen_hours = max(unique_hours)
        duplicate_variants = len(unique_hours) > 1

        comment = ""
        status = "active"
        if duplicate_variants:
            status = "check"
            variants = ", ".join(format_decimal(value) for value in unique_hours)
            comment = f"В таблице несколько вариантов нормо-часов: {variants}. Взято максимальное значение."

        converted.append(
            {
                "brand": brand,
                "model": model,
                "year": year,
                "service": service,
                "service_group": service_group(service),
                "synonyms": [],
                "price": rounded_int(chosen_hours * rate),
                "duration_min": rounded_int(chosen_hours * Decimal("60")),
                "comment": comment,
                "status": status,
                "updated_at": updated_at,
            }
        )

    return converted


def write_services_json(path, rows, version):
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps({"version": version, "services": rows}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description="Convert autoservice norm-hour Excel table to services.json.")
    parser.add_argument("source", help="Path to .xlsx/.xls OOXML workbook")
    parser.add_argument("target", help="Path to output services.json")
    parser.add_argument("--hour-rate", required=True, help="Ruble price for one norm-hour")
    parser.add_argument("--updated-at", required=True, help="Data version label, for example 2026-05")
    args = parser.parse_args(argv)

    source_rows = read_xlsx_rows(args.source)
    converted = convert_rows(source_rows, args.hour_rate, args.updated_at)
    write_services_json(args.target, converted, args.updated_at)
    print(f"Converted {len(converted)} rows from {len(source_rows)} source rows.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
