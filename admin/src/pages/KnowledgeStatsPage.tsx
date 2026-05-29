import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Card } from '../components/ui';

interface KnowledgeStats {
  productCount: number;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
}

export function KnowledgeStatsPage() {
  const [data, setData] = useState<KnowledgeStats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<KnowledgeStats>('/admin/knowledge/stats')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!data) return <p className="text-slate-500">Загрузка…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">База знаний</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Продукты в Qdrant">
          <p className="text-3xl font-semibold">{data.productCount}</p>
          <p className="text-sm text-slate-500 mt-1">точек с source=product</p>
        </Card>
        <Card title="Последняя синхронизация">
          {data.lastSyncAt ? (
            <div className="text-sm space-y-1">
              <p className="text-lg font-medium">{data.lastSyncAt}</p>
              {data.lastSyncStatus && (
                <p className="text-slate-500">Статус: {data.lastSyncStatus}</p>
              )}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">Успешных sync пока не было</p>
          )}
        </Card>
      </div>

      <Card title="Подсказка">
        <p className="text-sm text-slate-600">
          Синхронизация загружает каталог из KPPDF и индексирует продукты в Qdrant. Запустите «Синхронизация
          каталога» на странице «Задачи» или с Dashboard.
        </p>
      </Card>
    </div>
  );
}
