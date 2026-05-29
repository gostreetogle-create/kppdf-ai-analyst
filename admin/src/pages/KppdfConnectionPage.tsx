import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Card } from '../components/ui';

interface KppdfSettings {
  baseUrl: string;
  username: string;
  passwordConfigured: boolean;
  connectionOk?: boolean;
  connectionError?: string;
  note?: string;
}

export function KppdfConnectionPage() {
  const [data, setData] = useState<KppdfSettings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<KppdfSettings>('/admin/settings/kppdf')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <p className="text-slate-500">Загрузка…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Подключение KPPDF</h1>

      <Card title="Параметры (только просмотр)">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">API URL</dt>
            <dd className="font-mono text-xs mt-1 break-all">{data.baseUrl}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Username</dt>
            <dd className="mt-1">{data.username || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Пароль</dt>
            <dd className="mt-1">{data.passwordConfigured ? 'Задан в .env' : 'Не задан'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Связь с KPPDF</dt>
            <dd className="mt-1">
              {data.connectionOk ? (
                <span className="text-green-700 font-medium">Доступен</span>
              ) : (
                <span className="text-red-600 font-medium">
                  Недоступен{data.connectionError ? `: ${data.connectionError}` : ''}
                </span>
              )}
            </dd>
          </div>
        </dl>
        {data.note && <p className="text-xs text-slate-500 mt-4">{data.note}</p>}
      </Card>
    </div>
  );
}
