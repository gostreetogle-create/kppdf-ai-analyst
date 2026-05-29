# Decision: KPPDF auth через cookies

**Дата:** 2026-05-29  
**Статус:** принято

## Контекст

KPPDF `POST /api/v1/auth/login` принимает `{ username, password }` и возвращает профиль в теле. JWT access/refresh — в httpOnly cookies (`kppdf_access_token`, `kppdf_refresh_token`). Access TTL = 15m.

## Решение

`kppdf.client.ts`:

1. Login → парсить `Set-Cookie` → хранить access + refresh in-memory
2. API-запросы с `Authorization: Bearer {accessToken}`
3. При 401 → `POST /auth/refresh` → повтор запроса
4. **Не** хранить static JWT в `.env` как основной способ auth

## Env

```env
KPPDF_AUTH_USERNAME=ai-sync
KPPDF_AUTH_PASSWORD=ai-sync123
```

## Альтернатива (отклонена)

Static `KPPDF_SERVICE_TOKEN` в .env — протухает через 15m без refresh.
