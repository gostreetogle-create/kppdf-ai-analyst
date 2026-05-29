# План действий: kppdf-ai-analyst + интеграция с KPPDF 3.0

> **Решение:** AI-аналитик — **отдельный проект и отдельный git-репозиторий**.  
> KPPDF 3.0 — source of truth + proxy + UI `/news`.  
> Дата: 2026-05-29

---

## Архитектура

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  kppdf-3.0 (существующий)   │  HTTP   │  kppdf-ai-analyst (новый repo)   │
│  D:\invSportiN\Сайт\kppdf-3.0│ ◄────► │  D:\invSportiN\Сайт\kppdf-ai-analyst│
├─────────────────────────────┤         ├──────────────────────────────────┤
│ backend/  — ai-proxy        │ X-API-Key│ backend/  — API :3100            │
│ src/      — /news UI        │         │ admin/    — React dashboard       │
│ MongoDB   — товары, auth    │ ◄─sync──│ MongoDB   — news, providers      │
│                             │  JWT    │ Qdrant    — RAG embeddings       │
└─────────────────────────────┘         │ OpenRouter — chat + embed          │
                                        └──────────────────────────────────┘
```

| Компонент | Где | Порт |
|-----------|-----|------|
| KPPDF API | `kppdf-3.0/backend` | 3000 |
| KPPDF Angular | `kppdf-3.0/src` | 4200 |
| AI API | `kppdf-ai-analyst/backend` | 3100 |
| AI Admin | `kppdf-ai-analyst/admin` | 5174 (dev) |
| Qdrant | docker | 6333 |
| AI MongoDB | docker | 27018 |

---

## Репозиторий 1: kppdf-ai-analyst (создать с нуля)

### Путь и git

```bash
D:\invSportiN\Сайт\kppdf-ai-analyst\
git init
git remote add origin <url>   # после создания на GitHub/GitLab
```

### Структура проекта

```
kppdf-ai-analyst/
├── backend/
│   └── src/
│       ├── config/
│       ├── clients/kppdf.client.ts
│       ├── modules/
│       │   ├── providers/          # multi-AI router + AiProvider model
│       │   ├── admin/              # /admin/* JWT API
│       │   ├── openrouter/         # или через provider router
│       │   ├── qdrant/
│       │   ├── knowledge/          # indexer + topic extract
│       │   ├── news/               # analyst, rss, router
│       │   └── agent/              # AgentRun model
│       ├── middleware/api-key.auth.ts
│       ├── jobs/scheduler.ts
│       ├── app.ts
│       └── server.ts
├── admin/                          # React + Vite + Tailwind + shadcn
│   └── src/pages/
│       ├── DashboardPage.tsx
│       ├── ProvidersPage.tsx
│       ├── ModelsPage.tsx
│       ├── KppdfConnectionPage.tsx
│       ├── KnowledgePage.tsx
│       ├── NewsPage.tsx
│       ├── JobsPage.tsx
│       └── AgentRunsPage.tsx
├── shared/types/                   # контракт API (копия с KPPDF)
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── README.md
└── package.json                    # root scripts: dev, docker up
```

### Backend — ключевые модули

| Модуль | Назначение |
|--------|------------|
| `kppdf.client` | Sync products/categories из KPPDF (`body.data`, не `items`) |
| `knowledge/indexer` | Products → embeddings → Qdrant |
| `news/topic-extractor` | Топ-15 тем из каталога (без LLM) |
| `news/rss-fetcher` | Google News RSS, код-цикл, pause 400ms |
| `news/news-analyst.service` | sync → topics → RAG → RSS → LLM curate → save |
| `providers/` | OpenRouter, OpenAI, Anthropic, Google, Custom + encrypted keys |
| `admin/` | CRUD providers, test connection, settings, jobs |

### Public API (`/v1/*`, header `X-API-Key`)

| Method | Path | Описание |
|--------|------|----------|
| GET | `/v1/health` | без auth |
| GET | `/v1/news` | лента |
| GET | `/v1/news/topics` | фильтры |
| POST | `/v1/news/refresh` | запуск workflow |
| POST | `/v1/sync` | sync каталога |
| GET | `/v1/runs` | agent runs |
| POST | `/v1/ask` | v2 |

### Admin API (`/admin/*`, JWT)

Login, providers CRUD, test, dashboard stats, settings, manual jobs.

### Admin UI — экраны

Dashboard · AI-провайдеры · Модели по задачам · KPPDF connection · Knowledge · News preview · Jobs · Agent Runs

### Env (`.env.example`)

```
PORT=3100
MONGO_URI=mongodb://localhost:27018/kppdf_ai
QDRANT_URL=http://localhost:6333
KPPDF_API_URL=http://localhost:3000/api/v1
KPPDF_SERVICE_TOKEN=
AI_SERVICE_API_KEY=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=
ADMIN_ENCRYPTION_SECRET=
OPENROUTER_API_KEY=
SYNC_INTERVAL_HOURS=12
NEWS_REFRESH_INTERVAL_HOURS=6
```

### Зависимости backend

`express`, `mongoose`, `@qdrant/js-client-rest`, `rss-parser`, `node-cron`, `uuid` — **без** `openai`, `undici` (native fetch).

---

## Репозиторий 2: kppdf-3.0 (минимальные изменения)

### Новые файлы

```
backend/src/modules/ai-proxy/
├── ai-proxy.config.ts
├── ai-proxy.client.ts
└── news.router.ts          # GET /news, GET /topics, POST /refresh

shared/types/
├── newsItem.interface.ts
└── newsTopic.interface.ts  # или INewsTopic в newsItem

src/app/features/news/
├── news-page.component.ts
├── news-card.component.ts
├── news.service.ts         # через ApiService
├── news.store.ts
└── index.ts
```

### Изменяемые файлы

| Файл | Изменение |
|------|-----------|
| `backend/src/app.ts` | `app.use('/api/v1/news', authenticate, newsRouter)` |
| `backend/.env.example` | `AI_SERVICE_URL`, `AI_SERVICE_API_KEY` |
| `backend/src/seed.ts` | user `ai-sync@kppdf.ru`, role с `office.products.view`, `admin.categories.view` |
| `src/app/core/permissions.ts` | `news: { view, refresh }` |
| `src/app/app.routes.ts` | route `/news` |
| `src/app/layout/admin-layout/...` | пункт «Новости отрасли» в группе Продажи |
| `docker-compose.yml` | опционально: только документация, Qdrant живёт в AI repo |

### Proxy — правила

- `GET /api/v1/news` → `requirePermission('office.news.view')`
- `POST /api/v1/news/refresh` → `requirePermission('office.news.refresh')`
- Middleware: `authenticate` + `requirePermission` из `middleware/`
- Ответы через `success()` / `paginated()` — формат KPPDF
- AI недоступен → **503** с текстом «AI-аналитик недоступен»

### Frontend — правила

- `ApiService`, не raw HttpClient
- `app-page-layout`, `KpSelectComponent`, SCSS grid
- `AuthService.hasPermission('office.news.refresh')` для кнопки «Обновить»
- `menuGroups` + `requiresAny: [PERMISSIONS.news.view]`

---

## Shared contract (синхронизировать в обоих repo)

```typescript
// shared/types/newsItem.interface.ts
interface INewsItem {
  _id?: string;
  title: string;
  summary: string;
  url: string;
  sourceName?: string;
  publishedAt: string;       // ISO в JSON
  topicSlug: string;
  topicLabel: string;
  relatedProductIds?: string[];
  imageUrl?: string;
  fetchedAt: string;
  agentRunId?: string;
  isActive: boolean;
}
```

v1: копия файла в оба repo. v2: npm-пакет `@kppdf/ai-contracts`.

---

## News workflow (канон — без багов)

```
1. syncCatalog()        → KPPDF API → Qdrant reindex
2. extractTopics()      → топ-15 категорий (код)
3. per topic:
     semanticSearch()   → RAG top-5 products
     for each query:
       fetchRss()        → Google News (код, pause)
4. dedupByUrl()
5. openRouter.curateNews() → анонсы + relatedProductIds (URL только из input)
6. save NewsItem + index news in Qdrant
7. log AgentRun
```

**Запрещено:** просить LLM «выполни fetch_rss».

---

## Фазы реализации

### Фаза 0 — Подготовка (0.5 дня)

- [x] Создать папку `D:\invSportiN\Сайт\kppdf-ai-analyst`
- [x] `git init`, `.gitignore`, README
- [ ] Создать remote repo (GitHub/GitLab)
- [ ] Согласовать `AI_SERVICE_API_KEY` (один секрет в обоих `.env`)
- [ ] Добавить service account в KPPDF seed + получить token для sync

### Фаза 1 — AI backend MVP (2–3 дня)

- [ ] Scaffold backend: config, server, mongo, docker-compose (qdrant + mongo)
- [ ] OpenRouter service (native fetch): chat + embed
- [ ] Qdrant service: upsert, search, health
- [ ] KPPDF client: paginate `body.data`, categories
- [ ] Knowledge indexer + topic extractor
- [ ] RSS fetcher
- [ ] News analyst service (6 steps)
- [ ] NewsItem + AgentRun models
- [ ] API: `/v1/health`, `/v1/news`, `/topics`, `/refresh`, `/sync`, `/runs`
- [ ] Scheduler + startup sync
- [ ] Smoke: health → sync → refresh → GET news

### Фаза 2 — AI Admin (1–2 дня)

- [ ] Admin JWT auth
- [ ] AiProvider model + encryption
- [ ] Provider router (chat/embed by task)
- [ ] Admin API: providers CRUD, test, dashboard, settings
- [ ] React admin: Dashboard + Providers + Models + KPPDF + Runs
- [ ] Serve admin build from backend `/admin` (prod)

### Фаза 3 — KPPDF integration (1 день)

- [ ] `shared/types/newsItem.interface.ts`
- [ ] `ai-proxy` module
- [ ] Permissions + seed role
- [ ] Angular `/news` feature
- [ ] Route + menu
- [ ] E2E: UI → KPPDF proxy → AI → cards

### Фаза 4 — Hardening (0.5–1 день)

- [ ] Обработка 503 когда AI offline
- [ ] Тесты: topic-extractor, rss dedup, URL validation в curate
- [ ] README в обоих repo: как запускать локально
- [ ] Docker prod build AI service

### Фаза 5 — v2 (позже)

- [ ] `POST /v1/ask` + proxy `/api/v1/ai/ask`
- [ ] Chat UI или виджет в KPPDF
- [ ] Tender matcher, compliance workflows

---

## Локальный запуск (целевой)

```bash
# Terminal 1 — KPPDF
cd D:\invSportiN\Сайт\kppdf-3.0
docker compose up -d mongodb
npm run backend
npm start

# Terminal 2 — AI
cd D:\invSportiN\Сайт\kppdf-ai-analyst
docker compose up -d
cd backend && npm run dev

# Terminal 3 — Admin (dev)
cd D:\invSportiN\Сайт\kppdf-ai-analyst\admin && npm run dev
```

---

## Чеклист v1

| # | Проверка | Ожидание |
|---|----------|----------|
| 1 | AI `GET /v1/health` | qdrant ok |
| 2 | AI `POST /v1/sync` | products indexed |
| 3 | AI `POST /v1/news/refresh` | saved ≥ 0 |
| 4 | Admin login + provider test | ok |
| 5 | KPPDF `GET /api/v1/news` | proxy → cards |
| 6 | Angular `/news` | карточки, ссылки работают |
| 7 | AI offline | KPPDF 503 |

---

## Критические правки из ревью черновика

1. KPPDF list API → `response.data`, не `items`
2. Auth middleware → `authenticate`, `requirePermission` (не utils/)
3. `Category.slug` не существует → slug из `fullPath`
4. Qdrant payload flat → filter `source`, не `metadata.source`
5. RSS только в коде, LLM только curate
6. `publishedAt` / `fetchedAt` → `Date` в Mongo для TTL
7. Express routes: `app.use('/v1/news', router)` где router = `/`, `/topics`, `/refresh`

---

## Оценка трудозатрат

| Фаза | Срок |
|------|------|
| 0 Подготовка | 0.5 д |
| 1 AI backend | 2–3 д |
| 2 Admin | 1–2 д |
| 3 KPPDF | 1 д |
| 4 Hardening | 0.5–1 д |
| **Итого v1** | **~5–7 дней** |

---

## Следующий шаг

После вашего **«реализуй»**:

1. Создать git repo `kppdf-ai-analyst` + scaffold Фазы 0–1  
2. Затем proxy + `/news` в KPPDF (Фаза 3)
