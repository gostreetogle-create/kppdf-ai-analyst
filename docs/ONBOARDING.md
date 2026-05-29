# Onboarding — kppdf-ai-analyst

> Операционные правила (границы repo, порты, диагностика sync): [PROJECT_RULES.md](PROJECT_RULES.md)

## Prerequisites

- Node.js 20+
- Docker Desktop
- KPPDF 3.0 локально на `:3000` (для sync)
- OpenRouter API key (для news curate; sync/indexer может работать без него)

## 1. Секреты

```bash
cp .env.example .env
```

| Переменная | Описание |
|------------|----------|
| `AI_SERVICE_API_KEY` | Shared secret для `X-API-Key` (не OpenRouter!). `openssl rand -hex 32` |
| `OPENROUTER_API_KEY` | Ключ с openrouter.ai — bootstrap, пока не задан провайдер в админке |
| `KPPDF_AUTH_USERNAME` | `ai-sync` (не email!) |
| `KPPDF_AUTH_PASSWORD` | из seed kppdf-3.0, по умолчанию `ai-sync123` |
| `ADMIN_USERNAME` | Логин админки (по умолчанию `admin`) |
| `ADMIN_PASSWORD` | Пароль админки |
| `ADMIN_JWT_SECRET` | Подпись JWT для `/admin/*` |
| `ADMIN_ENCRYPTION_SECRET` | AES-256-GCM для API-ключей провайдеров (≥16 символов) |

## 2. Service account в KPPDF

В `kppdf-3.0/backend/src/seed.ts` добавлены роль `ai-sync` и пользователь:

- username: `ai-sync`
- email: `ai-sync@kppdf.ru`
- password: `ai-sync123`
- permissions: `office.products.view`, `admin.categories.view`

```bash
cd ../kppdf-3.0/backend
npm run seed   # или как запускается seed в вашем проекте
npm run dev    # backend :3000
```

JWT **не кладётся в .env** — `kppdf.client` логинится при старте и обновляет токен через cookies (см. ADR 002).

## 3. Запуск AI-сервиса

**Windows (рекомендуется):**

```powershell
cd kppdf-ai-analyst
.\start.cmd          # Docker + backend :3100 + admin :5174 (по умолчанию)
.\start.ps1 -NoAdmin # только backend, без admin :5174
.\stop.ps1           # остановка; .\stop.ps1 -KeepDocker — оставить Mongo/Qdrant
```

**Production:**

```bash
npm run build:all
NODE_ENV=production npm start
# http://localhost:3100/admin/
```

**Вручную / Linux (dev):**

```bash
cd kppdf-ai-analyst
docker compose up -d          # Mongo :27018, Qdrant :6333
cd backend && npm install
cd .. && npm run dev          # :3100
cd admin && npm run dev       # :5174 (отдельный терминал)
```

## 4. Админка

`start.cmd` / `start.ps1` запускают админку **по умолчанию** на http://localhost:5174.

| Параметр | Значение |
|----------|----------|
| URL (dev) | http://localhost:5174 |
| URL (prod) | http://localhost:3100/admin/ |
| Логин | `ADMIN_USERNAME` → `admin` |
| Пароль | `ADMIN_PASSWORD` из `.env` |

Страницы:

1. **Обзор** — health, быстрые кнопки Sync / News refresh
2. **KPPDF** — read-only подключение к kppdf-3.0
3. **Задачи** — ручной запуск sync и news refresh
4. **Новости: поиск** — лимиты тем, паузы RSS/curate, свои RSS-ленты, пресет «Быстрый тест» (без sync каталога)
5. **Новости** — превью ленты из Mongo
6. **Знания** — статистика Qdrant (products)
7. **Провайдеры / Модели / Запуски** — настройка AI и история AgentRun

KPPDF URL/username — только просмотр (настройка в `.env`).

> **503 «AI offline»** в UI KPPDF — ответственность **kppdf-proxy** (Фаза 3), не этого сервиса.

## 5. Smoke-тесты (v1)

```bash
# Health (без ключа)
curl http://localhost:3100/v1/health

# Sync (нужен KPPDF :3000)
curl -X POST -H "X-API-Key: YOUR_KEY" http://localhost:3100/v1/sync

# News refresh (нужен OpenRouter)
curl -X POST -H "X-API-Key: YOUR_KEY" http://localhost:3100/v1/news/refresh

# Лента
curl -H "X-API-Key: YOUR_KEY" "http://localhost:3100/v1/news?limit=5"
```

## Типичные ошибки

| Симптом | Причина | Решение |
|---------|---------|---------|
| `fetch failed`, ECONNREFUSED | KPPDF не запущен | Запустить kppdf backend на `:3000` |
| 401 от KPPDF | Нет `ai-sync` в kppdf Mongo или неверный пароль | `npm run seed` в kppdf-3.0; проверить `KPPDF_AUTH_*` |
| 404 products | Неверный path | `/directories/products`, не `/office/products` |
| Qdrant down | Docker не запущен | `docker compose up -d` |
| Empty sync | KPPDF не на :3000 или пустой каталог | Запустить kppdf backend; проверить данные |

## Glossary

| Термин | Значение |
|--------|----------|
| **sync** | Загрузка products из KPPDF → embeddings → Qdrant |
| **refresh** | News pipeline: topics → RSS → curate → Mongo |
| **RAG** | Retrieval-Augmented Generation — поиск в Qdrant + LLM |
| **curate** | LLM выбирает и аннотирует новости (URL только из input) |
| **AgentRun** | Лог одного прогона sync или news_refresh |
