import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Button, Card } from '../components/ui';

interface SheetsSettings {
  sheetId: string;
  productsRange: string;
  catalogRange: string;
  catalogSheetName: string;
  catalogSyncSource?: string;
  catalogHeaders: string[];
  serviceAccountEmail: string;
  credentialsConfigured: boolean;
  authMode: string;
  readOnly?: boolean;
  note?: string;
}

interface SyncResult {
  status: string;
  stats?: {
    productsFetched: number;
    categoriesFetched: number;
    productsIndexed: number;
    source: string;
  };
  error?: string;
}

interface TestResult {
  ok: boolean;
  spreadsheetTitle?: string;
  range: string;
  rowCount: number;
  headers: string[];
  sampleRows: string[][];
  error?: string;
}

interface InitResult {
  ok: boolean;
  created: boolean;
  sheetTitle: string;
  headers: string[];
  range: string;
  message: string;
  error?: string;
}

interface PreviewItem {
  sku?: string;
  name?: string;
  category?: string;
  subcategory?: string;
}

interface PreviewResult {
  configured: boolean;
  range: string;
  totalDataRows: number;
  parsedCount: number;
  headers: string[];
  items: PreviewItem[];
}

const SAMPLE_ROWS = [
  {
    sku: 'TEST-001',
    name: 'Футбольный мяч профессиональный',
    category: 'Спортивный инвентарь',
    subcategory: 'Мячи',
    description: 'Мяч FIFA Quality Pro, размер 5',
    purpose: 'Тренировки и матчи',
    materials: 'PU, латекс',
    isActive: 'TRUE',
  },
  {
    sku: 'TEST-002',
    name: 'Стойка баскетбольная переносная',
    category: 'Спортивный инвентарь',
    subcategory: 'Стойки',
    description: 'Переносная стойка для баскетбола',
    purpose: 'Школы, секции',
    materials: 'Сталь, акрил',
    isActive: 'TRUE',
  },
  {
    sku: 'TEST-003',
    name: 'Коврик гимнастический',
    category: 'Спортивный инвентарь',
    subcategory: 'Коврики',
    description: 'Коврик 200×100×5 см',
    purpose: 'Гимнастика, ОФП',
    materials: 'Пенополиэтилен',
    isActive: 'TRUE',
  },
];

export function GoogleSheetsPage() {
  const [settings, setSettings] = useState<SheetsSettings | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [init, setInit] = useState<InitResult | null>(null);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<SheetsSettings>('/admin/settings/google-sheets')
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  async function runInit() {
    setLoading(true);
    setError('');
    setInit(null);
    try {
      const result = await apiFetch<InitResult>(
        '/admin/integrations/google-sheets/init-catalog-sheet',
        { method: 'POST' },
      );
      setInit(result);
      if (!result.ok && result.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка создания листа');
    } finally {
      setLoading(false);
    }
  }

  async function runSync() {
    setLoading(true);
    setError('');
    setSync(null);
    try {
      const result = await apiFetch<SyncResult>(
        '/admin/integrations/google-sheets/sync-catalog',
        { method: 'POST' },
      );
      setSync(result);
      if (result.status === 'failed' && result.error) setError(result.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка синхронизации');
    } finally {
      setLoading(false);
    }
  }

  async function runTest() {
    setLoading(true);
    setError('');
    setTest(null);
    try {
      const result = await apiFetch<TestResult>('/admin/integrations/google-sheets/test', {
        method: 'POST',
      });
      setTest(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка теста');
    } finally {
      setLoading(false);
    }
  }

  async function loadPreview() {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<PreviewResult>(
        '/admin/integrations/google-sheets/products-preview?limit=15',
      );
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка превью');
    } finally {
      setLoading(false);
    }
  }

  if (!settings && !error) return <p className="text-slate-500">Загрузка…</p>;

  const sheetUrl = settings?.sheetId
    ? `https://docs.google.com/spreadsheets/d/${settings.sheetId}/edit`
    : '';
  const catalogTabUrl = sheetUrl && settings?.catalogSheetName
    ? `${sheetUrl}#gid=0`
    : sheetUrl;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Google Таблица</h1>
      <p className="text-sm text-slate-600">
        Тестовый каталог без KPPDF — лист <code className="bg-slate-100 px-1 rounded">{settings?.catalogSheetName || 'ai_analyst_catalog'}</code>
      </p>

      {error && <Alert type="error">{error}</Alert>}

      <Card title="Подключение">
        {settings && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Sheet ID</dt>
              <dd className="font-mono text-xs mt-1 break-all">{settings.sheetId || '—'}</dd>
              {sheetUrl && (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 text-xs hover:underline"
                >
                  Открыть таблицу
                </a>
              )}
            </div>
            <div>
              <dt className="text-slate-500">Диапазон каталога</dt>
              <dd className="font-mono text-xs mt-1">{settings.catalogRange}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Production products (не трогаем)</dt>
              <dd className="font-mono text-xs mt-1 text-slate-400">{settings.productsRange}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Service account</dt>
              <dd className="mt-1 break-all">{settings.serviceAccountEmail || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Источник sync / news</dt>
              <dd className="mt-1 font-mono text-xs">{settings.catalogSyncSource || '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Credentials</dt>
              <dd className="mt-1">
                {settings.credentialsConfigured ? (
                  <span className="text-green-700">Настроены ({settings.authMode})</span>
                ) : (
                  <span className="text-red-600">Не заданы в .env</span>
                )}
              </dd>
            </div>
          </dl>
        )}
        {settings?.note && <p className="text-xs text-slate-500 mt-4">{settings.note}</p>}
      </Card>

      <Card title="Шаг 1 — создать лист">
        <p className="text-sm text-slate-600 mb-4">
          Создаёт вкладку <strong>{settings?.catalogSheetName}</strong> с заголовками колонок.
          Production-лист <code className="bg-slate-100 px-1 rounded text-xs">products</code> не изменяется.
        </p>
        <Button disabled={loading || !settings?.credentialsConfigured} onClick={runInit}>
          {loading ? 'Создание…' : `Создать лист ${settings?.catalogSheetName || 'ai_analyst_catalog'}`}
        </Button>
        {init && (
          <div className="mt-4 text-sm space-y-1">
            <p>
              Статус:{' '}
              <strong className={init.ok ? 'text-green-700' : 'text-red-600'}>
                {init.ok ? 'OK' : 'Ошибка'}
              </strong>
            </p>
            <p>{init.message}</p>
            {init.created && catalogTabUrl && (
              <a href={catalogTabUrl} target="_blank" rel="noreferrer" className="text-brand-600 text-xs hover:underline">
                Открыть таблицу и вставить данные
              </a>
            )}
            {init.error && <p className="text-red-600">{init.error}</p>}
          </div>
        )}
      </Card>

      <Card title="Шаг 2 — какие данные вставить">
        <p className="text-sm text-slate-600 mb-3">
          После создания листа добавьте <strong>3–10 строк</strong> товаров (строка 1 — заголовки, уже записаны).
        </p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-2">Колонка</th>
                <th className="py-2 pr-2">Обязательно</th>
                <th className="py-2">Зачем</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Артикул</td><td>да</td><td>уникальный ключ</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Наименование</td><td>да</td><td>название для RAG</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Категория</td><td>да</td><td>темы / контекст</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Подкатегория</td><td>рекомендуется</td><td>уточнение</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Описание</td><td>рекомендуется</td><td>текст для embedding</td></tr>
              <tr className="border-b border-slate-100"><td className="py-1.5 pr-2">Назначение, Материалы</td><td>опционально</td><td>как в kppdf products</td></tr>
              <tr><td className="py-1.5 pr-2">isActive</td><td>опционально</td><td>TRUE / FALSE</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 mb-2">Примеры строк (можно скопировать):</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-1 pr-2">Артикул</th>
                <th className="py-1 pr-2">Наименование</th>
                <th className="py-1 pr-2">Категория</th>
                <th className="py-1 pr-2">Подкатегория</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_ROWS.map((row) => (
                <tr key={row.sku} className="border-b border-slate-100">
                  <td className="py-1 pr-2 font-mono">{row.sku}</td>
                  <td className="py-1 pr-2">{row.name}</td>
                  <td className="py-1 pr-2">{row.category}</td>
                  <td className="py-1 pr-2">{row.subcategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Шаг 3 — синхронизация в Qdrant">
        <p className="text-sm text-slate-600 mb-4">
          Читает лист, создаёт embeddings (OpenRouter) и индексирует товары в Qdrant.
          Нужен <code className="bg-slate-100 px-1 rounded text-xs">OPENROUTER_API_KEY</code> в .env.
        </p>
        <Button disabled={loading || !settings?.credentialsConfigured} onClick={runSync}>
          {loading ? 'Синхронизация…' : 'Синхронизировать каталог → Qdrant'}
        </Button>
        {sync && (
          <div className="mt-4 text-sm space-y-1">
            <p>
              Статус:{' '}
              <strong className={sync.status === 'success' ? 'text-green-700' : 'text-red-600'}>
                {sync.status === 'success' ? 'OK' : 'Ошибка'}
              </strong>
            </p>
            {sync.stats && (
              <p>
                Товаров: {sync.stats.productsFetched}, категорий: {sync.stats.categoriesFetched},
                проиндексировано: {sync.stats.productsIndexed} ({sync.stats.source})
              </p>
            )}
            {sync.error && <p className="text-red-600">{sync.error}</p>}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-4">
          После sync → <a href="#/jobs" className="text-brand-600 hover:underline">Задачи</a>
          {' '}→ «Обновить новости» (RSS + LLM по категориям из таблицы).
        </p>
      </Card>

      <Card title="Шаг 4 — тест подключения">
        <div className="flex flex-wrap gap-3">
          <Button disabled={loading || !settings?.credentialsConfigured} onClick={runTest}>
            {loading ? 'Проверка…' : 'Проверить подключение'}
          </Button>
          <Button
            variant="secondary"
            disabled={loading || !settings?.credentialsConfigured}
            onClick={loadPreview}
          >
            Превью товаров
          </Button>
        </div>

        {test && (
          <div className="mt-4 text-sm space-y-2">
            <p>
              Статус:{' '}
              <strong className={test.ok ? 'text-green-700' : 'text-red-600'}>
                {test.ok ? 'OK' : 'Ошибка'}
              </strong>
            </p>
            {test.spreadsheetTitle && <p>Таблица: {test.spreadsheetTitle}</p>}
            {test.ok && (
              <p>
                Строк данных: {test.rowCount}, колонок: {test.headers.length}
              </p>
            )}
            {test.error && <p className="text-red-600">{test.error}</p>}
            {test.headers.length > 0 && (
              <p className="text-xs text-slate-500">Заголовки: {test.headers.join(', ')}</p>
            )}
            {test.sampleRows.length > 0 && (
              <pre className="text-xs bg-slate-50 p-3 rounded overflow-x-auto max-h-40">
                {JSON.stringify(test.sampleRows.slice(0, 3), null, 2)}
              </pre>
            )}
          </div>
        )}
      </Card>

      {preview && (
        <Card title={`Превью каталога (${preview.parsedCount} строк с артикулом/названием)`}>
          <p className="text-xs text-slate-500 mb-3">
            Диапазон: {preview.range}, всего строк: {preview.totalDataRows}
          </p>
          {preview.items.length === 0 ? (
            <p className="text-slate-500 text-sm">Нет данных — вставьте строки в лист и нажмите «Превью» снова.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="py-2 pr-3">Артикул</th>
                    <th className="py-2 pr-3">Наименование</th>
                    <th className="py-2 pr-3">Категория</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item, i) => (
                    <tr key={`${item.sku}-${i}`} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-xs">{item.sku || '—'}</td>
                      <td className="py-2 pr-3">{item.name || '—'}</td>
                      <td className="py-2 pr-3 text-slate-600">{item.category || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
