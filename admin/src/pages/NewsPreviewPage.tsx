import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Button, Card, Input, Label } from '../components/ui';

interface NewsItemRow {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName?: string;
  publishedAt: string;
  topicSlug: string;
  topicLabel: string;
}

interface NewsResponse {
  data: NewsItemRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function NewsPreviewPage() {
  const [items, setItems] = useState<NewsItemRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [topic, setTopic] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (topic.trim()) params.set('topic', topic.trim());
    if (q.trim()) params.set('q', q.trim());

    apiFetch<NewsResponse>(`/admin/news?${params}`)
      .then((r) => {
        setItems(r.data);
        setTotalPages(r.totalPages);
        setTotal(r.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [page, topic, q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Новости (превью)</h1>

      {error && <Alert type="error">{error}</Alert>}

      <Card title="Фильтры">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <Label>Тема (topicSlug)</Label>
            <Input value={topic} onChange={(e) => { setTopic(e.target.value); setPage(1); }} placeholder="например pumps" />
          </div>
          <div>
            <Label>Поиск</Label>
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="заголовок, источник…" />
          </div>
          <Button variant="secondary" onClick={() => load()} disabled={loading}>
            Обновить
          </Button>
        </div>
        <p className="text-xs text-slate-500 mt-2">Всего: {total}</p>
      </Card>

      <Card>
        {loading && items.length === 0 ? (
          <p className="text-slate-500 text-sm">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-sm">Новостей нет — запустите обновление на странице «Задачи»</p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="border-b border-slate-100 pb-4 last:border-0">
                <h3 className="font-medium text-slate-900">
                  <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-brand-600">
                    {item.title}
                  </a>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {item.topicLabel} · {item.sourceName || '—'} · {item.publishedAt}
                </p>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{item.summary}</p>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-100">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Назад
            </Button>
            <span className="text-sm text-slate-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
