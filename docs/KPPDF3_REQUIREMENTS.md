# Требования к KPPDF 3.0 для kppdf-ai-analyst

> Документ для передачи команде **kppdf-3.0**. Что должно быть на стороне KPPDF, чтобы AI-аналитик работал корректно.
>
> Обратная сторона (что делает ai-analyst): [PROJECT_RULES.md](PROJECT_RULES.md), [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Кратко: что нужно от kppdf-3.0

| Уровень | Что нужно | Зачем |
|---------|-----------|-------|
| **Минимум (sync)** | Backend `:3000`, seed `ai-sync`, каталог products/categories | Индексация RAG, news pipeline |
| **Полный v1 (UI)** | + ai-proxy, permissions, Angular `/news` | Новости в интерфейсе KPPDF |
| **Prod** | Одинаковый `AI_SERVICE_API_KEY`, стабильный URL AI | Безопасный proxy |

AI-analyst **не читает** Mongo kppdf напрямую — только через **HTTP API** kppdf backend.

---

## Чеклист A — Минимум для sync (обязательно сейчас)

Передайте в kppdf-3.0. Без этого sync в ai-analyst падает с `fetch failed` или `401`.

### A1. Инфраструктура

- [ ] KPPDF backend запущен и отвечает: `GET http://127.0.0.1:3000/api/v1/health` → **200**
- [ ] MongoDB kppdf (`kppdf30` на `:27017`) с данными каталога (products, categories)
- [ ] AI-analyst `.env`: `KPPDF_API_URL=http://localhost:3000/api/v1`

### A2. Service account `ai-sync` (seed)

- [ ] Роль **`ai-sync`** с permissions:
  - `office.products.view` — чтение products
  - `admin.categories.view` — чтение categories
- [ ] Пользователь:
  - `username`: **`ai-sync`** (не email!)
  - `email`: `ai-sync@kppdf.ru`
  - `password`: **`ai-sync123`** (или согласованный; тот же в ai-analyst `.env`)
- [ ] Выполнен `npm run seed` в `kppdf-3.0/backend` после добавления в seed

**Проверка login:**

```bash
curl -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"ai-sync\",\"password\":\"ai-sync123\"}"
```

Ожидается: **200**, заголовки `Set-Cookie` с `kppdf_access_token`.

### A3. API каталога (контракт для ai-analyst)

AI-analyst вызывает **только эти URL** (не `/office/*`, не `/admin/*`):

| Method | Path | Permission ai-sync | Ответ |
|--------|------|-------------------|--------|
| `POST` | `/auth/login` | — | cookies + JSON |
| `POST` | `/auth/refresh` | — | cookies (TTL access ~15m) |
| `GET` | `/directories/products?page=&limit=` | `office.products.view` | paginated |
| `GET` | `/directories/categories?page=&limit=` | `admin.categories.view` | paginated |

**Формат paginated (обязательно):**

```json
{
  "success": true,
  "data": [ /* массив */ ],
  "total": 100,
  "page": 1,
  "limit": 50,
  "totalPages": 2
}
```

🔴 Массив в поле **`data`**, не `items`.

**Поля product (минимум для RAG):**

- `_id`, `name`, `categoryId`
- опционально: `description`, `sku`, `subcategory`, `purpose`, `materials`

**Поля category (минимум для topics):**

- `_id`, `name`
- **`fullPath`** — для slug темы (отдельного поля `slug` нет)

**Проверка каталога (с Bearer после login или через curl с cookie):**

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3000/api/v1/directories/products?page=1&limit=5"

curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:3000/api/v1/directories/categories?page=1&limit=5"
```

### A4. Auth — правила для server-to-server

- [ ] Login body: `{ "username": "...", "password": "..." }` — **username**, не email
- [ ] Токены в **httpOnly cookies** (`kppdf_access_token`, `kppdf_refresh_token`)
- [ ] Поддержка **Bearer** в `Authorization` для server-to-server (ai-analyst так ходит после login)
- [ ] Refresh при 401: `POST /auth/refresh`

### A5. Согласование env между repo

| Переменная | kppdf-ai-analyst | kppdf-3.0 (позже, Фаза 3) |
|------------|------------------|----------------------------|
| `KPPDF_AUTH_USERNAME` | `ai-sync` | — |
| `KPPDF_AUTH_PASSWORD` | = seed | — |
| `AI_SERVICE_API_KEY` | секрет A | **тот же** секрет A |
| `AI_SERVICE_URL` | — | `http://127.0.0.1:3100` |

---

## Чеклист B — Фаза 3: proxy + UI новостей (для end-to-end v1)

Нужно **в kppdf-3.0**, не в ai-analyst.

### B1. Backend ai-proxy

- [ ] Модуль `backend/src/modules/ai-proxy/`
- [ ] Env: `AI_SERVICE_URL`, `AI_SERVICE_API_KEY` (тот же ключ, что в ai-analyst)
- [ ] Native **fetch** (не axios)
- [ ] Маршруты под `/api/v1/news`:
  - `GET /` → proxy `GET {AI}/v1/news`
  - `GET /topics` → proxy `GET {AI}/v1/news/topics`
  - `POST /refresh` → proxy `POST {AI}/v1/news/refresh`
- [ ] Заголовок к AI: `X-API-Key: <AI_SERVICE_API_KEY>`
- [ ] RBAC:
  - `GET` → `office.news.view`
  - `POST /refresh` → `office.news.refresh`
- [ ] AI недоступен → **503** с текстом «AI-аналитик недоступен»
- [ ] Ответы через `success()` / `paginated()` — формат KPPDF

### B2. Shared contract

- [ ] `shared/types/newsItem.interface.ts` — копия из ai-analyst ([shared/types/newsItem.interface.ts](../shared/types/newsItem.interface.ts))
- [ ] `INewsTopic` при необходимости

### B3. Permissions + seed

- [ ] В `permissions.ts`: `news.view`, `news.refresh` (или `office.news.*`)
- [ ] Роли admin/manager — доступ к просмотру; refresh — по политике
- [ ] Пункт меню «Новости отрасли» (группа Продажи)

### B4. Angular UI

- [ ] Feature `src/app/features/news/`
- [ ] Route `/news`
- [ ] `ApiService` (не raw HttpClient)
- [ ] Карточки: title, summary, url, topicLabel, publishedAt
- [ ] Кнопка «Обновить» — `hasPermission('office.news.refresh')`

### B5. Smoke E2E (после Фазы 3)

- [ ] KPPDF `:3000` + AI `:3100` запущены
- [ ] `GET /api/v1/news` (с JWT пользователя KPPDF) → карточки
- [ ] AI остановлен → KPPDF `GET /api/v1/news` → **503**

---

## Чеклист C — Эксплуатация (оба repo)

- [ ] KPPDF и ai-analyst на **разных портах** (3000 / 3100) — можно параллельно
- [ ] `start.ps1` kppdf не убивает процессы ai-analyst (или согласованные скрипты)
- [ ] `OPENROUTER_API_KEY` только в ai-analyst (KPPDF не нужен)
- [ ] Регулярный sync: cron в ai-analyst или ручной из админки «Задачи»

---

## Диагностика (symptom → причина в kppdf)

| Симптом в ai-analyst | Что проверить в kppdf-3.0 |
|----------------------|---------------------------|
| `fetch failed` | Backend не на `:3000` |
| `401 Invalid credentials` | Нет `ai-sync` в Mongo / неверный пароль / seed не делали |
| `404` на products | URL должен быть `/directories/products` |
| Пустой sync, без ошибок | Каталог пуст в Mongo kppdf |
| 403 на directories | У роли `ai-sync` нет permissions |

---

## Промпты для ИИ в репозитории kppdf-3.0

### Промпт 1 — Service account (если sync 401)

```
В kppdf-3.0 backend нужен service user для kppdf-ai-analyst sync.

1. В backend/src/seed.ts добавь (или восстанови):
   - роль ai-sync: permissions office.products.view, admin.categories.view
   - user: username ai-sync, email ai-sync@kppdf.ru, password ai-sync123

2. npm run seed в backend/ (предупреди: пересоздаст тестовых users)

3. Проверь:
   curl -X POST http://127.0.0.1:3000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d "{\"username\":\"ai-sync\",\"password\":\"ai-sync123\"}"
   Ожидаю 200 + Set-Cookie kppdf_access_token.

4. Проверь каталог (с Bearer):
   GET /api/v1/directories/products?page=1&limit=5
   GET /api/v1/directories/categories?page=1&limit=5
   Ответ: { success, data: [], total, ... } — массив в data, не items.

Не менять URL paths на /office/* или /admin/*.
Auth login: username+password, не email.
```

### Промпт 2 — Фаза 3: ai-proxy + Angular /news

```
Реализуй интеграцию kppdf-3.0 с kppdf-ai-analyst (Фаза 3).

Контекст:
- AI сервис: http://127.0.0.1:3100, auth X-API-Key
- Контракт новостей: скопировать shared/types/newsItem.interface.ts из repo kppdf-ai-analyst

Backend:
1. backend/src/modules/ai-proxy/
   - ai-proxy.config.ts: AI_SERVICE_URL, AI_SERVICE_API_KEY из .env
   - ai-proxy.client.ts: native fetch, header X-API-Key
   - news.router.ts:
     GET / → GET {AI}/v1/news
     GET /topics → GET {AI}/v1/news/topics
     POST /refresh → POST {AI}/v1/news/refresh

2. backend/src/app.ts:
   app.use('/api/v1/news', authenticate, newsRouter)
   GET → requirePermission('office.news.view')
   POST /refresh → requirePermission('office.news.refresh')
   AI offline → 503 «AI-аналитик недоступен»

3. backend/.env.example:
   AI_SERVICE_URL=http://127.0.0.1:3100
   AI_SERVICE_API_KEY=<тот же секрет что в kppdf-ai-analyst .env>

Frontend:
4. src/app/features/news/ — news-page, news-card, news.service через ApiService
5. Route /news, menu «Новости отрасли», permissions office.news.view / office.news.refresh
6. app-page-layout, SCSS grid — как в остальном KPPDF

Запреты:
- не менять /directories/products paths
- не axios в proxy client
- paginated() для ответов KPPDF API
```

### Промпт 3 — Только проверка готовности API для sync

```
Проверь готовность kppdf-3.0 backend для kppdf-ai-analyst sync (без ai-proxy):

1. GET /api/v1/health → 200
2. POST /auth/login { username, password } для ai-sync → 200 + cookies
3. GET /directories/products и /directories/categories с Bearer:
   - paginated формат { success, data, total, page, limit, totalPages }
   - у products есть categoryId; у categories есть fullPath
4. Роль ai-sync имеет office.products.view и admin.categories.view

Выведи чеклист pass/fail и что исправить.
```

### Промпт 4 — 503 и отказоустойчивость proxy

```
В ai-proxy kppdf-3.0 добавь обработку недоступности AI:

- fetch к AI_SERVICE_URL с timeout 10s
- ECONNREFUSED / timeout / 5xx от AI → HTTP 503
- body: { success: false, error: "AI-аналитик недоступен" } (формат KPPDF)
- логировать [ai-proxy] с URL и кодом ошибки

Не падать с 500 stack trace наружу.
```

---

## Что kppdf-3.0 НЕ должен делать

- Не ходить в Qdrant / OpenRouter / Mongo ai-analyst
- Не дублировать news pipeline (RSS, LLM curate) — это только ai-analyst
- Не менять `AI_SERVICE_API_KEY` на OpenRouter key
- Не использовать `/office/products` как URL для sync-клиента

---

## Что ai-analyst делает сам (для ясности передачи)

| Функция | Где |
|---------|-----|
| Sync каталога → Qdrant | ai-analyst `:3100` |
| RSS + LLM curate новостей | ai-analyst |
| Хранение NewsItem | Mongo ai-analyst `:27018` |
| Admin UI, cron jobs | ai-analyst |
| Показ новостей пользователю KPPDF | kppdf proxy + Angular (Фаза 3) |

---

## Связанные документы

| Документ | Содержание |
|----------|------------|
| [PROJECT_RULES.md](PROJECT_RULES.md) | Границы repo, порты, диагностика |
| [ONBOARDING.md](ONBOARDING.md) | Запуск ai-analyst, smoke curl |
| [plans/ai-analyst-action-plan.md](plans/ai-analyst-action-plan.md) | Фазы 0–5 |
| [decisions/002-kppdf-auth-cookies.md](decisions/002-kppdf-auth-cookies.md) | ADR: cookies auth |
| [../shared/types/newsItem.interface.ts](../shared/types/newsItem.interface.ts) | Контракт INewsItem |

---

*Обновлено: 2026-05-29 — v1 admin + jobs API*
