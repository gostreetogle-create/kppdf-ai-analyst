# Google Sheets — тестовый каталог без KPPDF

> Читаем каталог напрямую из Google Sheets, минуя KPPDF API. Production-лист `products` не трогаем.

## Быстрый старт

1. Скопируйте credentials из `kppdf-3.0/tools/products_import_export/.env` в корневой `.env`:

```env
GOOGLE_SHEET_ID=1HMUpCiQIRYfTphGJUIQkjNB9CuUe-q8gddNcJYnk72Y
GOOGLE_SHEETS_CATALOG_RANGE=ai_analyst_catalog!A1:Z500
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

2. Service account должен быть **Editor** на таблице (Share в Google Sheets).

3. Перезапустите backend: `.\stop.ps1` → `.\start.cmd`

4. Admin → http://localhost:5174/#/google-sheets

## Лист `ai_analyst_catalog`

| Шаг | Действие |
|-----|----------|
| 1 | Кнопка **«Создать лист ai_analyst_catalog»** — создаёт вкладку + заголовки |
| 2 | Вставьте 3–10 строк товаров в Google Sheets |
| 3 | **Проверить подключение** + **Превью товаров** |

### Колонки (строка 1)

| Колонка | Обязательно |
|---------|-------------|
| Артикул | да |
| Наименование | да |
| Категория | да |
| Подкатегория | рекомендуется |
| Описание | рекомендуется |
| Назначение | опционально |
| Материалы | опционально |
| isActive | опционально (TRUE/FALSE) |

### Примеры строк

| Артикул | Наименование | Категория | Подкатегория |
|---------|--------------|-----------|--------------|
| TEST-001 | Футбольный мяч профессиональный | Спортивный инвентарь | Мячи |
| TEST-002 | Стойка баскетбольная переносная | Спортивный инвентарь | Стойки |
| TEST-003 | Коврик гимнастический | Спортивный инвентарь | Коврики |

## Шаг 4 — sync в Qdrant и новости

1. Убедитесь, что `OPENROUTER_API_KEY` задан в `.env`
2. Admin → **Google Таблица** → **Синхронизировать каталог → Qdrant**
3. Admin → **Задачи** → **Обновить новости**
4. Admin → **Новости** — результат

`CATALOG_SYNC_SOURCE=google_sheets` — sync и news topics берутся из листа `ai_analyst_catalog`, KPPDF не нужен.

## Admin API

| Method | Path | Описание |
|--------|------|----------|
| GET | `/admin/settings/google-sheets` | config (без секретов) |
| POST | `/admin/integrations/google-sheets/init-catalog-sheet` | создать лист + заголовки |
| POST | `/admin/integrations/google-sheets/sync-catalog` | Sheets → Qdrant |
| POST | `/admin/integrations/google-sheets/test` | ping + sample rows |
| GET | `/admin/integrations/google-sheets/products-preview?limit=20` | parsed products |

## Код

| Файл | Роль |
|------|------|
| `backend/src/clients/google-sheets.client.ts` | JWT, read/write, init sheet |
| `backend/src/modules/integrations/google-sheets.service.ts` | parse products, preview |
| `admin/src/pages/GoogleSheetsPage.tsx` | UI: init + test + preview |

## Production лист `products`

Лист `products` (kppdf import/export) остаётся на `GOOGLE_SHEETS_PRODUCTS_RANGE=products!A1:ZZ5000`.
Тестовый каталог читается из `GOOGLE_SHEETS_CATALOG_RANGE` — по умолчанию `ai_analyst_catalog!A1:Z500`.

## Дальнейшие шаги

- Запись результатов agent runs в отдельный лист Google Sheets
