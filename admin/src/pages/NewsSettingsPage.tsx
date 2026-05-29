import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Alert, Button, Card, Input, Label } from '../components/ui';

interface NewsSettings {
  topicsLimit: number;
  rssPauseMs: number;
  curateBatchSize: number;
  curatePauseMs: number;
  skipSyncInNewsRefresh: boolean;
  customRssUrls: string[];
  useGoogleNewsRss: boolean;
  rssSearchTemplate: string;
  maxRssItemsPerTopic: number;
}

const PRESET_FAST: NewsSettings = {
  topicsLimit: 3,
  rssPauseMs: 200,
  curateBatchSize: 4,
  curatePauseMs: 1000,
  skipSyncInNewsRefresh: true,
  customRssUrls: [],
  useGoogleNewsRss: true,
  rssSearchTemplate: '',
  maxRssItemsPerTopic: 8,
};

function applyPreset(
  preset: NewsSettings,
  setters: {
    setTopicsLimit: (v: number) => void;
    setRssPauseMs: (v: number) => void;
    setCurateBatchSize: (v: number) => void;
    setCuratePauseMs: (v: number) => void;
    setSkipSync: (v: boolean) => void;
    setUseGoogle: (v: boolean) => void;
    setRssTemplate: (v: string) => void;
    setMaxRss: (v: number) => void;
    setCustomUrlsText: (v: string) => void;
  },
) {
  setters.setTopicsLimit(preset.topicsLimit);
  setters.setRssPauseMs(preset.rssPauseMs);
  setters.setCurateBatchSize(preset.curateBatchSize);
  setters.setCuratePauseMs(preset.curatePauseMs);
  setters.setSkipSync(preset.skipSyncInNewsRefresh);
  setters.setUseGoogle(preset.useGoogleNewsRss);
  setters.setRssTemplate(preset.rssSearchTemplate);
  setters.setMaxRss(preset.maxRssItemsPerTopic);
  setters.setCustomUrlsText(preset.customRssUrls.join('\n'));
}

export function NewsSettingsPage() {
  const [topicsLimit, setTopicsLimit] = useState(15);
  const [rssPauseMs, setRssPauseMs] = useState(400);
  const [curateBatchSize, setCurateBatchSize] = useState(8);
  const [curatePauseMs, setCuratePauseMs] = useState(2000);
  const [skipSync, setSkipSync] = useState(false);
  const [useGoogle, setUseGoogle] = useState(true);
  const [rssTemplate, setRssTemplate] = useState('');
  const [maxRss, setMaxRss] = useState(20);
  const [customUrlsText, setCustomUrlsText] = useState('');
  const [source, setSource] = useState('');
  const [envDefaults, setEnvDefaults] = useState<NewsSettings | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const setters = {
    setTopicsLimit,
    setRssPauseMs,
    setCurateBatchSize,
    setCuratePauseMs,
    setSkipSync,
    setUseGoogle,
    setRssTemplate,
    setMaxRss,
    setCustomUrlsText,
  };

  useEffect(() => {
    apiFetch<{
      settings: NewsSettings;
      source: string;
      envDefaults: NewsSettings;
    }>('/admin/settings/news')
      .then((r) => {
        applyPreset(r.settings, setters);
        setSource(r.source);
        setEnvDefaults(r.envDefaults);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  }, []);

  function applyFullPreset() {
    if (envDefaults) applyPreset(envDefaults, setters);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const customRssUrls = customUrlsText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      await apiFetch('/admin/settings/news', {
        method: 'PUT',
        body: JSON.stringify({
          topicsLimit,
          rssPauseMs,
          curateBatchSize,
          curatePauseMs,
          skipSyncInNewsRefresh: skipSync,
          customRssUrls,
          useGoogleNewsRss: useGoogle,
          rssSearchTemplate: rssTemplate,
          maxRssItemsPerTopic: maxRss,
        }),
      });
      setSource('db');
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-slate-600">Загрузка…</p>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Настройки новостей</h1>
        <p className="text-sm text-slate-600 mt-1">
          Параметры поиска RSS и скорости пайплайна. Источник:{' '}
          <span className="font-medium">{source === 'db' ? 'админка (MongoDB)' : '.env'}</span>.
        </p>
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">Настройки сохранены. Следующий запуск «Обновить новости» использует их.</Alert>}

      <Card title="Пресеты">
        <p className="text-sm text-slate-600 mb-3">
          Быстрый тест — меньше тем и пауз, без sync каталога. Полный — значения по умолчанию из .env.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" type="button" onClick={() => applyPreset(PRESET_FAST, setters)}>
            Быстрый тест
          </Button>
          <Button variant="secondary" type="button" onClick={applyFullPreset} disabled={!envDefaults}>
            Полный прогон
          </Button>
        </div>
      </Card>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card title="Скорость и лимиты">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Число тем (категорий)</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={topicsLimit}
                onChange={(e) => setTopicsLimit(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Пауза между RSS-запросами (мс)</Label>
              <Input
                type="number"
                min={0}
                max={10000}
                value={rssPauseMs}
                onChange={(e) => setRssPauseMs(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Статей RSS на тему (макс.)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={maxRss}
                onChange={(e) => setMaxRss(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Пакет для LLM-curate</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={curateBatchSize}
                onChange={(e) => setCurateBatchSize(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Пауза между пакетами curate (мс)</Label>
              <Input
                type="number"
                min={0}
                max={60000}
                value={curatePauseMs}
                onChange={(e) => setCuratePauseMs(Number(e.target.value))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 mt-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={skipSync}
              onChange={(e) => setSkipSync(e.target.checked)}
              className="rounded border-slate-300"
            />
            Пропускать sync каталога при обновлении новостей (быстрее для dev)
          </label>
        </Card>

        <Card title="Источники RSS">
          <label className="flex items-center gap-2 mb-4 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={useGoogle}
              onChange={(e) => setUseGoogle(e.target.checked)}
              className="rounded border-slate-300"
            />
            Google News RSS по названию темы
          </label>
          <div className="mb-4">
            <Label>Шаблон поиска (необязательно)</Label>
            <Input
              value={rssTemplate}
              onChange={(e) => setRssTemplate(e.target.value)}
              placeholder="{label} новости или https://…/feed.xml"
            />
            <p className="text-xs text-slate-500 mt-1">
              Пусто — «{'{'}label{'}'} новости». Текст — подстановка {'{label}'} / {'{query}'}. URL —
              своя лента на каждую тему (без подстановки, если нет {'{query}'}).
            </p>
          </div>
          <div>
            <Label>Дополнительные RSS-ленты (по одной на строку)</Label>
            <textarea
              value={customUrlsText}
              onChange={(e) => setCustomUrlsText(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder={
                'https://news.google.com/rss/search?q=промышленность&hl=ru&gl=RU&ceid=RU:ru\nhttps://www.interfax.ru/rss.asp'
              }
            />
            <p className="text-xs text-slate-500 mt-1">
              Загружаются один раз за прогон, метка «Пользовательские ленты». Подойдут отраслевые
              RSS, если Google News не даёт нужных статей.
            </p>
          </div>
        </Card>

        <Button type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </Button>
      </form>
    </div>
  );
}
