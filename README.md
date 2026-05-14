# Калькулятор работ автосервиса

Статическое мини-приложение для операторов коллцентра. Работает по схеме:

```text
Марка -> модель -> год -> одна или несколько работ -> строки, сумма и время
```

## Как открыть

Из папки репозитория:

```bash
python3 -m http.server 8080 --directory workspace/autoservice-calculator
```

Затем открыть:

```text
http://localhost:8080
```

## Ежемесячное обновление данных

Пока реальный Excel еще не пришел, источник данных подготовлен как CSV:

```text
workspace/autoservice-calculator/data/services-template.csv
```

Колонки:

```text
brand,model,year,service,service_group,synonyms,price,duration_min,comment,status,updated_at
```

Обязательные колонки:

```text
brand,model,year,service,price,duration_min,status
```

Правила:

- `year` — конкретный год.
- `price` — конкретная цена в рублях, без "от".
- `duration_min` — время в минутах.
- `synonyms` — слова для поиска, через `;`.
- `status`:
  - `active` — показывать обычный результат.
  - `check` — показывать результат с пометкой "уточнить".
  - `hidden` — не включать строку в приложение.

Конвертация CSV в рабочий JSON:

```bash
node workspace/autoservice-calculator/scripts/convert-services.js \
  workspace/autoservice-calculator/data/services-template.csv \
  workspace/autoservice-calculator/data/services.json
```

Когда появится настоящий `.xlsx`, можно добавить отдельный импорт Excel или сохранять лист из Excel в CSV и запускать этот же конвертер.

## Несколько работ

Оператор может добавить в смету две, три или больше работ. Каждая работа остается отдельной строкой, а вверху показывается итоговая стоимость и суммарное время.

Если по одной из выбранных работ нет цены для выбранного авто, приложение:

- оставляет эту работу в смете;
- показывает предупреждение;
- считает итог только по найденным работам.
