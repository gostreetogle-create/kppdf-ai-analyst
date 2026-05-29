# kppdf-ai-analyst — инварианты для AI и разработчиков

> Читать **первым** перед правками.
> **Правила ведения проекта** (границы repo, порты, sync, start/stop): [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md)
> Execution plan: [docs/plans/ai-analyst-action-plan.md](docs/plans/ai-analyst-action-plan.md)

## Контекст

```
Проект:     kppdf-ai-analyst (отдельный repo)
Тип:        AI analytics: RAG + LLM + REST API
Стек:       Express + Mongoose + Qdrant + OpenRouter (native fetch)
AI API:     http://localhost:3100
KPPDF API:  http://localhost:3000/api/v1
Язык:       TypeScript strict
```

**v1:** news pipeline. **v2:** `/v1/ask` chat. **Не трогать** kppdf-3.0 Angular/proxy до Фазы 3.

## KPPDF integration

### API paths (не путать с permissions!)

| Ресурс | Path | Permission (RBAC) |
|--------|------|-------------------|
| Products | `GET /directories/products` | `office.products.view` |
| Categories | `GET /directories/categories` | `admin.categories.view` |
| Login | `POST /auth/login` | — |

🔴 **Запрещено:** `/office/products`, `/admin/categories` как URL.

### Auth

- Login body: `{ username, password }` — **не email**
- Service user: `username: ai-sync`, email: `ai-sync@kppdf.ru`
- Tokens в **httpOnly cookies**, не в JSON body
- Access TTL 15m → refresh через `POST /auth/refresh`
- Bearer header поддерживается для server-to-server

### Pagination

KPPDF `paginated()` → `{ success, data: T[], total, page, limit, totalPages }`

- Массив: **`response.data`** (fetch json) → поле `.data`
- 🔴 Не использовать `items`

## News workflow (канон)

```
1. syncCatalog()        → KPPDF → Qdrant
2. extractTopics()      → top-15 categories (code, slug from fullPath)
3. per topic: RAG top-5 → RSS (sleep 400ms)
4. dedupByUrl()
5. openRouter.curateNews() → summary + relatedProductIds (URL only from input)
6. save NewsItem + AgentRun
```

🔴 **Запрещено:** просить LLM выполнить fetch_rss.

## Qdrant

- Payload **flat**: `source: 'product'`, не `metadata.source`
- Point id = **`productId`** (stable, для idempotent upsert)
- Filter: `{ key: 'source', match: { value: 'product' } }`

## Контракты

- `shared/types/newsItem.interface.ts` — `INewsItem`, sync с kppdf-3.0
- `ICategory` без поля `slug` — slug из `fullPath`
- `IProduct` имеет `categoryId`, не `category.name` — join в indexer

## Env secrets

| Variable | Purpose |
|----------|---------|
| `AI_SERVICE_API_KEY` | X-API-Key между KPPDF proxy и AI |
| `OPENROUTER_API_KEY` | LLM + embeddings — **отдельный** ключ |

🔴 Не смешивать. `AI_SERVICE_API_KEY` ≠ OpenRouter.

## HTTP client

🔴 **native `fetch` only** — не добавлять axios.

## Public API routes

```
GET  /v1/health          — no auth
GET  /v1/news            — X-API-Key
GET  /v1/news/topics     — X-API-Key
POST /v1/news/refresh    — X-API-Key
POST /v1/sync            — X-API-Key
GET  /v1/runs            — X-API-Key
```

Register `apiKeyAuth` **after** `/v1/health`, before other `/v1/*`.

## Mongoose

- `publishedAt`, `fetchedAt` — type **Date** in schema
- JSON API responses — ISO strings

## Logs

Prefix: `[mongo]`, `[qdrant]`, `[kppdf]`, `[sync]`, `[news]`, `[server]`

## Smoke (Фаза 1 done when)

```bash
curl http://localhost:3100/v1/health
curl -X POST -H "X-API-Key: ..." http://localhost:3100/v1/sync
curl -X POST -H "X-API-Key: ..." http://localhost:3100/v1/news/refresh
curl -H "X-API-Key: ..." http://localhost:3100/v1/news
```

## Key files

| Path | Purpose |
|------|---------|
| `backend/src/clients/kppdf.client.ts` | KPPDF auth + pagination |
| `backend/src/modules/knowledge/` | Indexer |
| `backend/src/modules/news/` | Topic, RSS, analyst |
| `docs/PROJECT_RULES.md` | Правила ведения проекта (repo, порты, sync) |
| `docs/KPPDF3_REQUIREMENTS.md` | Требования к kppdf-3.0, чеклисты и промпты |
| `docs/ONBOARDING.md` | Local setup |
| `docs/ARCHITECTURE.md` | System design |

## Commits

Создавать commit **только по явной просьбе** пользователя.
