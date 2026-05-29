# Правила ведения проекта kppdf-ai-analyst

Краткие операционные правила для разработчиков и AI-агентов. Технические инварианты кода — в [AGENTS.md](../AGENTS.md).

## 1. Границы репозитория

| Репозиторий | Зона ответственности |
|-------------|---------------------|
| **kppdf-ai-analyst** (этот repo) | RAG, LLM, `/v1/*` API, admin UI, Mongo/Qdrant AI-сервиса |
| **kppdf-3.0** | Каталог, заказы, auth пользователей, ai-proxy, Angular UI |

**Правило:** этот repo — отдельный проект с отдельным деплоем. AI-агенты и разработчики **не меняют** код, API, seed и конфиг **kppdf-3.0** из этого workspace.

Если нужны правки в kppdf-3.0 (seed `ai-sync`, proxy, Angular `/news`) — используйте **[docs/KPPDF3_REQUIREMENTS.md](KPPDF3_REQUIREMENTS.md)** (чеклисты + готовые промпты) или передайте его команде kppdf-3.0.

Исключение: **Фаза 3** action-plan — интеграция proxy/UI в kppdf-3.0 по явному запросу.

## 2. Порты — оба стека одновременно

Сервисы **не конфликтуют** по портам; KPPDF и AI-analyst можно запускать параллельно.

| Сервис | KPPDF 3.0 | kppdf-ai-analyst |
|--------|-----------|------------------|
| Backend API | **3000** | **3100** |
| Frontend (dev) | **4200** | **5174** (admin) |
| MongoDB | **27017** | **27018** |
| Qdrant | — | **6333** |

Admin в prod: `http://localhost:3100/admin/` (статика с backend).

## 3. Зависимость от KPPDF

- **Sync и news pipeline** требуют работающий KPPDF backend на `:3000`.
- Сервисный пользователь **`ai-sync`** создаётся **только в kppdf-3.0** (seed), не в этом repo.
- Учётные данные в `.env` должны совпадать с seed kppdf:

```env
KPPDF_AUTH_USERNAME=ai-sync
KPPDF_AUTH_PASSWORD=ai-sync123   # или ваш пароль из seed
```

Подробнее: [ONBOARDING.md](ONBOARDING.md) §2.

## 4. Скрипты start/stop — только этот проект

`start.ps1`, `start.cmd`, `stop.ps1` управляют **только** процессами kppdf-ai-analyst:

- backend `:3100`, admin `:5174`
- Docker Mongo `:27018`, Qdrant `:6333` (если не `-SkipDocker` / `-KeepDocker`)

**Не останавливают и не запускают** KPPDF (`:3000`, `:4200`, Mongo `:27017`).

## 5. Диагностика ошибок sync

| Симптом в логах | Причина | Действие |
|-----------------|---------|----------|
| `fetch failed`, ECONNREFUSED | KPPDF не запущен или неверный `KPPDF_API_URL` | Запустить kppdf backend на `:3000` |
| **401** от KPPDF | Нет пользователя `ai-sync` или неверный пароль | `npm run seed` в kppdf-3.0; проверить `KPPDF_AUTH_*` |
| **404** products/categories | Неверный URL | `/directories/products`, не `/office/products` |
| Пустой sync без ошибок | KPPDF up, но каталог пуст | Проверить данные в kppdf Mongo |

Префиксы логов: `[kppdf]`, `[sync]`, `[news]`, `[qdrant]`, `[mongo]`, `[server]`.

## 6. Секреты и env

| Переменная | Назначение |
|------------|------------|
| `AI_SERVICE_API_KEY` | `X-API-Key` между kppdf proxy и AI — **не** OpenRouter |
| `OPENROUTER_API_KEY` | LLM + embeddings |
| `KPPDF_AUTH_*` | Логин сервисного пользователя kppdf |

- `.env` — локально, **не коммитить**.
- Шаблон: `.env.example`.

## 7. Git и коммиты

- Коммиты — **только по явной просьбе** пользователя (см. [AGENTS.md](../AGENTS.md)).
- Не коммитить: `.env`, `.ai-analyst-dev.session.json`, `node_modules/`, секреты.

## 8. Документация — что читать

| Документ | Когда |
|----------|-------|
| [PROJECT_RULES.md](PROJECT_RULES.md) | Границы repo, порты, sync, start/stop |
| [AGENTS.md](../AGENTS.md) | Инварианты кода для AI и разработчиков |
| [ONBOARDING.md](ONBOARDING.md) | Первый запуск, smoke-тесты |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Схема системы |
| [plans/ai-analyst-action-plan.md](plans/ai-analyst-action-plan.md) | Roadmap и фазы |
| [KPPDF3_REQUIREMENTS.md](KPPDF3_REQUIREMENTS.md) | **Требования к kppdf-3.0** — чеклисты и промпты для передачи |
| [GOOGLE_SHEETS.md](GOOGLE_SHEETS.md) | Google Таблица products (тестовое подключение) |

## 9. Код — ключевые запреты

- Native **`fetch` only** — не добавлять axios.
- KPPDF paths: `/directories/products`, `/directories/categories`.
- Login body: `{ username, password }` — не email.
- Pagination: массив в **`response.data`**, не `items`.
- Не просить LLM выполнять fetch RSS — RSS только в коде.

Полный список: [AGENTS.md](../AGENTS.md).

## 10. Промпты для kppdf-3.0

Полный набор чеклистов и промптов (sync, Фаза 3, диагностика): **[KPPDF3_REQUIREMENTS.md](KPPDF3_REQUIREMENTS.md)**

Краткий промпт Фазы 3 (дубликат — полная версия в KPPDF3_REQUIREMENTS):

```
Реализуй интеграцию с kppdf-ai-analyst (Фаза 3):

1. backend/src/modules/ai-proxy/
   - ai-proxy.config.ts: AI_SERVICE_URL=http://127.0.0.1:3100, AI_SERVICE_API_KEY из .env
   - ai-proxy.client.ts: native fetch, header X-API-Key
   - news.router.ts: GET / → proxy GET /v1/news, GET /topics → /v1/news/topics,
     POST /refresh → POST /v1/news/refresh

2. backend/src/app.ts: app.use('/api/v1/news', authenticate, newsRouter)
   - GET: requirePermission('office.news.view')
   - POST refresh: requirePermission('office.news.refresh')
   - AI недоступен → 503 «AI-аналитик недоступен»

3. shared/types/newsItem.interface.ts — синхрон с kppdf-ai-analyst

4. Angular src/app/features/news/ — страница /news, ApiService, карточки новостей

5. permissions, menu «Новости отрасли», route /news

6. .env.example: AI_SERVICE_URL, AI_SERVICE_API_KEY (тот же секрет, что в ai-analyst .env)

Не менять paths каталога (/directories/products). Auth: username + cookies.
```
