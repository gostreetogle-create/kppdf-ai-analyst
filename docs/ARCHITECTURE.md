# Архитектура kppdf-ai-analyst

> AI-сервис аналитики для KPPDF 3.0. Отдельный репозиторий, отдельный деплой.

## Роль в экосистеме

| Система | Ответственность |
|---------|-----------------|
| **kppdf-3.0** | PLM/ERP: каталог, заказы, auth пользователей, UI, ai-proxy |
| **kppdf-ai-analyst** | RAG, LLM, фоновые jobs, public API `/v1/*`, admin (Фаза 2) |

KPPDF **не знает** про Qdrant и OpenRouter — только HTTP к AI-сервису.

## Компоненты

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  kppdf-3.0                  │  HTTP   │  kppdf-ai-analyst                │
│  backend :3000              │ ◄────► │  backend :3100                    │
│  Angular :4200              │ X-API-Key                                │
│  MongoDB :27017 (catalog)   │         │  MongoDB :27018 (news, runs)    │
│  ai-proxy /api/v1/news      │ ◄─sync──│  Qdrant :6333 (embeddings)       │
└─────────────────────────────┘   JWT   │  OpenRouter (chat + embed)       │
                                        └──────────────────────────────────┘
```

## Хранилища

| Store | Данные |
|-------|--------|
| **MongoDB (AI)** | NewsItem, AgentRun, настройки провайдеров (Фаза 2) |
| **Qdrant** | Векторы товаров (`source: product`), позже — новости |
| **KPPDF Mongo** | Source of truth: products, categories, orders… |

Два Mongo — **намеренно**: разные домены, независимое масштабирование.

## Public API (`/v1/*`)

| Method | Path | Auth | Описание |
|--------|------|------|----------|
| GET | `/v1/health` | — | mongo + qdrant status |
| GET | `/v1/news` | X-API-Key | лента новостей |
| GET | `/v1/news/topics` | X-API-Key | фильтры тем |
| POST | `/v1/news/refresh` | X-API-Key | запуск news pipeline |
| POST | `/v1/sync` | X-API-Key | sync каталога → Qdrant |
| GET | `/v1/runs` | X-API-Key | история AgentRun |

## News workflow (v1)

```
syncCatalog → extractTopics(15) → per topic: RAG top-5 → RSS (pause 400ms) →
dedupByUrl → curateNews(LLM) → save INewsItem → log AgentRun
```

**Правила:** RSS только в коде; LLM только curate; URL только из input.

## Roadmap

- **v1:** news pipeline + KPPDF proxy + `/news` UI
- **v2:** `POST /v1/ask` — чат по бизнес-данным
- **v3:** tender matcher, compliance workflows

## Связанные документы

- [action-plan](plans/ai-analyst-action-plan.md)
- [decisions/001-separate-repo.md](decisions/001-separate-repo.md)
- [decisions/002-kppdf-auth-cookies.md](decisions/002-kppdf-auth-cookies.md)
