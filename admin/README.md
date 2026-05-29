# Admin UI — kppdf-ai-analyst

React + Vite + Tailwind. Настройка AI-провайдеров, моделей и просмотр запусков без правки `.env`.

## Dev

```bash
# Терминал 1 — backend :3100
npm run dev

# Терминал 2 — админка :5174
npm run dev:admin
```

Или `.\start.ps1 -WithAdmin` (Windows).

Открыть: http://localhost:5174

Прокси Vite перенаправляет `/admin/*` на backend.

## Вход

Логин/пароль из `.env`:

- `ADMIN_USERNAME` (по умолчанию `admin`)
- `ADMIN_PASSWORD`

Также нужен `ADMIN_ENCRYPTION_SECRET` (≥16 символов) для сохранения API-ключей провайдеров.

## Prod

```bash
cd admin && npm run build
cd ../backend && npm run start
```

UI: http://localhost:3100/admin/

## Экраны

| Раздел | Назначение |
|--------|------------|
| Обзор | Mongo/Qdrant, счётчик новостей, последние runs |
| Провайдеры AI | OpenRouter API key (шифрование), тест, default |
| Модели | embed / chat / curate model ids |
| Запуски | AgentRun |

KPPDF — только просмотр (read-only из `.env`).
