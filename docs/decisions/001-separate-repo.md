# Decision: отдельный репозиторий

**Дата:** 2026-05-29  
**Статус:** принято

## Контекст

AI-аналитик требует Qdrant, OpenRouter, фоновые jobs и отдельный Mongo. KPPDF — PLM/ERP с Angular + Express.

## Решение

Отдельный git-репозиторий `kppdf-ai-analyst` с HTTP-интеграцией через ai-proxy в kppdf-3.0.

## Последствия

- Независимый деплой и масштабирование AI
- KPPDF остаётся source of truth для каталога
- Shared types копируются в оба repo (v2: npm-пакет `@kppdf/ai-contracts`)
- Два MongoDB — намеренно
