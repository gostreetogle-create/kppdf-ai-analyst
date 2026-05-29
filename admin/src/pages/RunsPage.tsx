import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Card } from '../components/ui';
import { trRunStatus, trRunType } from '../locale';

interface Run {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  finishedAt?: string;
  error?: string;
  stats?: Record<string, unknown>;
}

export function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ runs: Run[] }>('/admin/runs?limit=100')
      .then((r) => setRuns(r.runs))
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Запуски агента</h1>
      {error && <Alert type="error">{error}</Alert>}

      <Card>
        {runs.length === 0 ? (
          <p className="text-slate-500 text-sm">Запусков пока нет</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-3">Тип</th>
                  <th className="py-2 pr-3">Статус</th>
                  <th className="py-2 pr-3">Начало</th>
                  <th className="py-2 pr-3">Конец</th>
                  <th className="py-2">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{trRunType(r.type)}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          r.status === 'success'
                            ? 'text-green-700'
                            : r.status === 'failed'
                              ? 'text-red-600'
                              : 'text-amber-600'
                        }
                      >
                        {trRunStatus(r.status)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{r.startedAt}</td>
                    <td className="py-2 pr-3 text-xs text-slate-600">{r.finishedAt || '—'}</td>
                    <td className="py-2 text-xs text-red-600 max-w-xs truncate">{r.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
