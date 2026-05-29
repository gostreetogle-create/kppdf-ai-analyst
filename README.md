# kppdf-ai-analyst

AI-платформа **«Аналитик проекта»** для [KPPDF 3.0](https://github.com/invSportiN/kppdf-3.0): индексирует бизнес-данные (RAG), анализирует через LLM, отдаёт результат по API. KPPDF — source of truth, proxy и UI.

## Roadmap

| Версия | Сценарий | API |
|--------|----------|-----|
| **v1** (сейчас) | Новости отрасли, релевантные каталогу | `GET /v1/news`, `POST /v1/sync`, `POST /v1/news/refresh` |
| **v2** | Чат / ask по бизнесу | `POST /v1/ask` |
| **v3** | Тендеры, compliance | TBD |

## Архитектура (кратко)

```
KPPDF 3.0 (:3000)  ──HTTP/X-API-Key──►  kppdf-ai-analyst (:3100)
   catalog, auth                           Mongo + Qdrant + OpenRouter
   proxy /news, UI /news
```

Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Quick start

```bash
# Всё одной командой (Windows): Docker + backend :3100 + admin :5174
.\start.cmd

# Остановка
.\stop.ps1

# Smoke
curl http://localhost:3100/v1/health
```

Полная инструкция: [docs/ONBOARDING.md](docs/ONBOARDING.md)

## Документация

| Документ | Описание |
|----------|----------|
| [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md) | **Правила ведения проекта** — границы repo, порты, sync, start/stop |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Схема, границы сервисов, v1 vs roadmap |
| [docs/ONBOARDING.md](docs/ONBOARDING.md) | Локальный запуск, секреты, smoke |
| [docs/plans/ai-analyst-action-plan.md](docs/plans/ai-analyst-action-plan.md) | План реализации, API, фазы |
| [AGENTS.md](AGENTS.md) | Инварианты кода для AI-агентов и разработчиков |

## Статус

- [x] Intro kit (docs, AGENTS, scaffold)
- [x] **Фаза 2 Admin** — React админка :5174, `/admin/*` JWT API, провайдеры и модели в MongoDB
- [ ] `GET /v1/health` — mongo + qdrant ok
- [ ] `POST /v1/sync` — products indexed
- [ ] `POST /v1/news/refresh` — pipeline ok
- [ ] KPPDF proxy + Angular `/news`

## Порты

KPPDF и AI-analyst **запускаются параллельно** (разные порты). Подробнее: [docs/PROJECT_RULES.md](docs/PROJECT_RULES.md#2-порты--оба-стека-одновременно).

| Сервис | kppdf-ai-analyst | KPPDF 3.0 |
|--------|------------------|-----------|
| Backend API | **3100** | **3000** |
| Frontend (dev) | **5174** (admin) | **4200** |
| MongoDB | **27018** | **27017** |
| Qdrant | **6333** | — |
| Admin (prod) | http://localhost:3100/admin/ | — |

## Путь

`D:\invSportiN\Сайт\kppdf-ai-analyst`
