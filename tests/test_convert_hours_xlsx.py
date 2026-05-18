import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "convert_hours_xlsx.py"


def load_converter():
    spec = importlib.util.spec_from_file_location("convert_hours_xlsx", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ConvertHoursXlsxTest(unittest.TestCase):
    def test_parses_single_and_multi_word_brands(self):
        converter = load_converter()

        self.assertEqual(
            converter.parse_model_name("ACURA MDX (2000-)"),
            ("ACURA", "MDX (2000-)"),
        )
        self.assertEqual(
            converter.parse_model_name("LAND ROVER DISCOVERY IV (2009-)"),
            ("LAND ROVER", "DISCOVERY IV (2009-)"),
        )
        self.assertEqual(
            converter.parse_model_name("ALFA ROMEO 159 (2005-)"),
            ("ALFA ROMEO", "159 (2005-)"),
        )
        self.assertEqual(
            converter.parse_model_name("PEZHO"),
            ("PEZHO", "PEZHO"),
        )

    def test_converts_hours_to_price_duration_and_duplicate_warning(self):
        converter = load_converter()
        rows = [
            {
                "model_name": "ACURA MDX (2000-)",
                "year": "2014",
                "service": "ДВС масло замена с фильтром",
                "hours": "0.5",
            },
            {
                "model_name": "ACURA MDX (2000-)",
                "year": "2014",
                "service": "ДВС масло замена с фильтром",
                "hours": "0.65",
            },
            {
                "model_name": "LAND ROVER DISCOVERY IV (2009-)",
                "year": "2012",
                "service": "Регулировка углов установки колес",
                "hours": "1.2",
            },
        ]

        converted = converter.convert_rows(rows, hourly_rate=3200, updated_at="2026-05")

        self.assertEqual(len(converted), 2)
        self.assertEqual(converted[0]["brand"], "ACURA")
        self.assertEqual(converted[0]["model"], "MDX (2000-)")
        self.assertEqual(converted[0]["price"], 2080)
        self.assertEqual(converted[0]["duration_min"], 39)
        self.assertEqual(converted[0]["status"], "check")
        self.assertIn("0.5", converted[0]["comment"])
        self.assertIn("0.65", converted[0]["comment"])
        self.assertEqual(converted[1]["brand"], "LAND ROVER")
        self.assertEqual(converted[1]["status"], "active")

    def test_expands_generic_year_one_to_known_concrete_model_years(self):
        converter = load_converter()
        rows = [
            {
                "model_name": "AUDI Q5 (2008-)",
                "year": "2008",
                "service": "АКПП масло замена аппаратная",
                "hours": "2.5",
            },
            {
                "model_name": "AUDI Q5 (2008-)",
                "year": "2014",
                "service": "АКПП масло замена аппаратная",
                "hours": "2.5",
            },
            {
                "model_name": "AUDI Q5 (2008-)",
                "year": "1",
                "service": "ДВС диагностика",
                "hours": "1",
            },
        ]

        converted = converter.convert_rows(rows, hourly_rate=3000, updated_at="2026-05")
        diagnostics = [row for row in converted if row["service"] == "ДВС диагностика"]

        self.assertEqual([row["year"] for row in diagnostics], [2008, 2014])
        self.assertEqual([row["price"] for row in diagnostics], [3000, 3000])

    def test_skips_rows_without_norm_hours(self):
        converter = load_converter()
        rows = [
            {
                "model_name": "CHERY TIGGO (2002-)",
                "year": "2008",
                "service": "ДВС Датчик кислорода снятие установка",
                "hours": "",
            },
            {
                "model_name": "CHERY TIGGO (2002-)",
                "year": "2008",
                "service": "ДВС масло замена с фильтром",
                "hours": "0.5",
            },
        ]

        converted = converter.convert_rows(rows, hourly_rate=3000, updated_at="2026-05")

        self.assertEqual(len(converted), 1)
        self.assertEqual(converted[0]["service"], "ДВС масло замена с фильтром")

    def test_skips_rows_with_non_positive_norm_hours(self):
        converter = load_converter()
        rows = [
            {
                "model_name": "KIA CEED (2006-)",
                "year": "2014",
                "service": "Кузов бензонасос в баке снятие установка",
                "hours": "-2",
            },
            {
                "model_name": "KIA CEED (2006-)",
                "year": "2014",
                "service": "ДВС масло замена с фильтром",
                "hours": "0.5",
            },
        ]

        converted = converter.convert_rows(rows, hourly_rate=3000, updated_at="2026-05")

        self.assertEqual(len(converted), 1)
        self.assertEqual(converted[0]["service"], "ДВС масло замена с фильтром")


if __name__ == "__main__":
    unittest.main()
