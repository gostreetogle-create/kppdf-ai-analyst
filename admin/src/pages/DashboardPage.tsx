import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Button, Card } from '../components/ui';
import { trModelSource, trRunStatus } from '../locale';

interface DashboardData {
  newsCount: number;
  health: { mongo: boolean; qdrant: boolean };
  models: { embedModel: string; chatModel: string; curateModel: string; source: string };
  lastSyncRun: { status: string; startedAt: string; error?: string } | null;
  lastNewsRun: { status: string; startedAt: string; error?: string } | null;
}

interface JobResult {
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(
    null,
  );

  const loadDashboard = useCallback(() => {
    apiFetch<DashboardData>('/admin/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function runJob(path: string, kind: 'sync' | 'news') {
    const setLoading = kind === 'sync' ? setSyncLoading : setNewsLoading;
    setLoading(true);
    setActionMsg(null);
    try {
      const result = await apiFetch<JobResult>(path, { method: 'POST' });
      if (result.status === 'success') {
        setActionMsg({
          type: 'success',
          text: kind === 'sync' ? 'Синхронизация завершена' : 'Новости обновлены',
        });
      } else if (result.status === 'skipped') {
        setActionMsg({ type: 'info', text: result.error || 'Задача уже выполняется' });
      } else {
        setActionMsg({ type: 'error', text: result.error || 'Ошибка' });
      }
      loadDashboard();
    } catch (e) {
      setActionMsg({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setLoading(false);
    }
  }

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <p className="text-slate-500">Загрузка…</p>;

  const statusBadge = (ok: boolean) =>
    ok ? (
      <span className="text-green-700 font-medium">Доступен</span>
    ) : (
      <span className="text-red-600 font-medium">Недоступен</span>
    );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Обзор</h1>

      {actionMsg && <Alert type={actionMsg.type}>{actionMsg.text}</Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Новости">
          <p className="text-3xl font-semibold">{data.newsCount}</p>
          <p className="text-sm text-slate-500 mt-1">активных записей</p>
        </Card>
        <Card title="MongoDB">{statusBadge(data.health.mongo)}</Card>
        <Card title="Qdrant">{statusBadge(data.health.qdrant)}</Card>
      </div>

      <Card title="Быстрые действия">
        <div className="flex flex-wrap gap-3">
          <Button disabled={syncLoading || newsLoading} onClick={() => runJob('/admin/jobs/sync', 'sync')}>
            {syncLoading ? 'Синхронизация…' : 'Синхронизировать каталог'}
          </Button>
          <Button
            variant="secondary"
            disabled={syncLoading || newsLoading}
            onClick={() => runJob('/admin/jobs/news-refresh', 'news')}
          >
            {newsLoading ? 'Обновление…' : 'Обновить новости'}
          </Button>
        </div>
      </Card>

      <Card title={`Модели (источник: ${trModelSource(data.models.source)})`}>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Эмбеддинги</dt>
            <dd className="font-mono text-xs mt-1 break-all">{data.models.embedModel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Чат</dt>
            <dd className="font-mono text-xs mt-1 break-all">{data.models.chatModel}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Курация новостей</dt>
            <dd className="font-mono text-xs mt-1 break-all">{data.models.curateModel}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Последняя синхронизация">
          {data.lastSyncRun ? (
            <div className="text-sm space-y-1">
              <p>
                Статус: <strong>{trRunStatus(data.lastSyncRun.status)}</strong>
              </p>
              <p className="text-slate-500">{data.lastSyncRun.startedAt}</p>
              {data.lastSyncRun.error && <p className="text-red-600">{data.lastSyncRun.error}</p>}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Запусков не было</p>
          )}
        </Card>
        <Card title="Последнее обновление новостей">
          {data.lastNewsRun ? (
            <div className="text-sm space-y-1">
              <p>
                Статус: <strong>{trRunStatus(data.lastNewsRun.status)}</strong>
              </p>
              <p className="text-slate-500">{data.lastNewsRun.startedAt}</p>
              {data.lastNewsRun.error && <p className="text-red-600">{data.lastNewsRun.error}</p>}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Запусков не было</p>
          )}
        </Card>
      </div>
    </div>
  );
}
