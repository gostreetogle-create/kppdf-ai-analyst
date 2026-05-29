import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Button, Card } from '../components/ui';
import { trRunStatus, trRunType } from '../locale';

interface JobResult {
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  stats?: Record<string, unknown>;
}

interface Run {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export function JobsPage() {
  const [syncLoading, setSyncLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(
    null,
  );
  const [lastSync, setLastSync] = useState<Run | null>(null);
  const [lastNews, setLastNews] = useState<Run | null>(null);

  const loadRuns = useCallback(() => {
    apiFetch<{ runs: Run[] }>('/admin/runs?limit=20')
      .then((r) => {
        setLastSync(r.runs.find((x) => x.type === 'sync') ?? null);
        setLastNews(r.runs.find((x) => x.type === 'news_refresh') ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  async function recoverStaleRuns() {
    setMessage(null);
    try {
      const result = await apiFetch<{ ok: boolean; recovered: number }>(
        '/admin/jobs/recover-stale-runs',
        { method: 'POST' },
      );
      setMessage({
        type: 'info',
        text: result.recovered
          ? `Сброшено зависших задач: ${result.recovered}`
          : 'Зависших задач не найдено',
      });
      loadRuns();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' });
    }
  }

  async function runJob(path: string, kind: 'sync' | 'news') {
    const setLoading = kind === 'sync' ? setSyncLoading : setNewsLoading;
    setLoading(true);
    setMessage(null);
    try {
      const result = await apiFetch<JobResult>(path, { method: 'POST' });
      if (result.status === 'success') {
        setMessage({ type: 'success', text: kind === 'sync' ? 'Синхронизация завершена' : 'Новости обновлены' });
      } else if (result.status === 'skipped') {
        setMessage({ type: 'info', text: result.error || 'Задача уже выполняется' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Ошибка выполнения' });
      }
      loadRuns();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Ошибка' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Задачи</h1>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <Card title="Ручной запуск">
        <div className="flex flex-wrap gap-3">
          <Button disabled={syncLoading || newsLoading} onClick={() => runJob('/admin/jobs/sync', 'sync')}>
            {syncLoading ? 'Синхронизация…' : 'Синхронизация каталога'}
          </Button>
          <Button
            variant="secondary"
            disabled={syncLoading || newsLoading}
            onClick={() => runJob('/admin/jobs/news-refresh', 'news')}
          >
            {newsLoading ? 'Обновление…' : 'Обновление новостей'}
          </Button>
          <Button variant="secondary" disabled={syncLoading || newsLoading} onClick={recoverStaleRuns}>
            Сбросить зависшие
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Sync OK из Google Sheets. News refresh занимает 1–5 мин — не нажимайте повторно.
          Если в списке runs «Выполняется» зависло — «Сбросить зависшие», перезапуск backend, затем снова news.
          Для chat смените модель с <code className="bg-slate-100 px-1 rounded">:free</code> в admin → Модели
          (например <code className="bg-slate-100 px-1 rounded">google/gemma-2-9b-it:free</code> или платную).
        </p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={`Последний: ${trRunType('sync')}`}>
          {lastSync ? (
            <div className="text-sm space-y-1">
              <p>
                Статус: <strong>{trRunStatus(lastSync.status)}</strong>
              </p>
              <p className="text-slate-500">{lastSync.startedAt}</p>
              {lastSync.error && <p className="text-red-600">{lastSync.error}</p>}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Запусков не было</p>
          )}
        </Card>
        <Card title={`Последний: ${trRunType('news_refresh')}`}>
          {lastNews ? (
            <div className="text-sm space-y-1">
              <p>
                Статус: <strong>{trRunStatus(lastNews.status)}</strong>
              </p>
              <p className="text-slate-500">{lastNews.startedAt}</p>
              {lastNews.error && <p className="text-red-600">{lastNews.error}</p>}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Запусков не было</p>
          )}
        </Card>
      </div>
    </div>
  );
}
