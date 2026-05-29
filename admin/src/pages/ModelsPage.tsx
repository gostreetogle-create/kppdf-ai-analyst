import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../api/client';
import { Alert, Button, Card, Input, Label } from '../components/ui';
import { trModelSource } from '../locale';

interface OpenRouterModelInfo {
  id: string;
  name: string;
  contextLength: number | null;
}

interface ModelValidationError {
  field: 'embedModel' | 'chatModel' | 'curateModel';
  message: string;
}

function ModelPicker({
  label,
  value,
  onChange,
  options,
  listId,
  placeholder,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: OpenRouterModelInfo[];
  listId: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder={placeholder}
        required={required}
        className={error ? 'border-red-400' : undefined}
      />
      <datalist id={listId}>
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </datalist>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      {value && !options.some((m) => m.id === value) && (
        <p className="text-xs text-amber-600 mt-1">
          Модель не в списке OpenRouter — проверьте идентификатор перед сохранением
        </p>
      )}
    </div>
  );
}

export function ModelsPage() {
  const [embedModel, setEmbedModel] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [curateModel, setCurateModel] = useState('');
  const [embedOptions, setEmbedOptions] = useState<OpenRouterModelInfo[]>([]);
  const [chatOptions, setChatOptions] = useState<OpenRouterModelInfo[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [envDefaults, setEnvDefaults] = useState<{
    embedModel: string;
    chatModel: string;
    curateModel: string;
  } | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    embed?: { ok: boolean; message: string };
    chat?: { ok: boolean; message: string };
  } | null>(null);

  function loadModels() {
    return apiFetch<{
      settings: { embedModel: string; chatModel: string; curateModel: string };
      source: string;
      envDefaults: { embedModel: string; chatModel: string; curateModel: string };
    }>('/admin/settings/models').then((r) => {
      setEmbedModel(r.settings.embedModel);
      setChatModel(r.settings.chatModel);
      setCurateModel(r.settings.curateModel);
      setEnvDefaults(r.envDefaults);
      setSource(r.source);
    });
  }

  function loadCatalog() {
    return apiFetch<{ chat: OpenRouterModelInfo[]; embed: OpenRouterModelInfo[] }>(
      '/admin/openrouter/models',
    ).then((r) => {
      setChatOptions(r.chat);
      setEmbedOptions(r.embed);
      setCatalogLoaded(true);
    });
  }

  useEffect(() => {
    Promise.all([loadModels(), loadCatalog()]).catch((e) =>
      setError(e instanceof Error ? e.message : 'Ошибка'),
    );
  }, []);

  function applyValidationErrors(errors: ModelValidationError[]) {
    const map: Record<string, string> = {};
    for (const e of errors) {
      map[e.field] = e.message;
    }
    setFieldErrors(map);
  }

  async function onValidate() {
    setError('');
    setFieldErrors({});
    setTestResult(null);
    try {
      const r = await apiFetch<{ valid: boolean; errors: ModelValidationError[] }>(
        '/admin/models/validate',
        {
          method: 'POST',
          body: JSON.stringify({
            embedModel,
            chatModel,
            curateModel: curateModel || chatModel,
          }),
        },
      );
      if (!r.valid) {
        applyValidationErrors(r.errors);
        setError(r.errors.map((e) => e.message).join(' '));
      } else {
        setSaved(false);
        setError('');
      }
      return r.valid;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка проверки');
      return false;
    }
  }

  async function onTestModels() {
    setTesting(true);
    setError('');
    setFieldErrors({});
    setTestResult(null);
    try {
      const r = await apiFetch<{
        ok: boolean;
        embed: { ok: boolean; message: string };
        chat: { ok: boolean; message: string };
        error?: string;
        validation?: { errors: ModelValidationError[] };
      }>('/admin/models/test', {
        method: 'POST',
        body: JSON.stringify({ embedModel, chatModel }),
      });
      setTestResult(r);
      if (r.validation?.errors?.length) {
        applyValidationErrors(r.validation.errors);
      }
      if (!r.ok) {
        setError(r.error || [r.embed?.message, r.chat?.message].filter(Boolean).join(' '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка теста');
    } finally {
      setTesting(false);
    }
  }

  async function onResetDefaults() {
    setError('');
    setFieldErrors({});
    setSaved(false);
    setTestResult(null);
    setResetting(true);
    try {
      const r = await apiFetch<{
        settings: { embedModel: string; chatModel: string; curateModel: string };
        message: string;
      }>('/admin/settings/models/reset', { method: 'POST' });
      setEmbedModel(r.settings.embedModel);
      setChatModel(r.settings.chatModel);
      setCurateModel(r.settings.curateModel);
      setSource('db');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сброса');
    } finally {
      setResetting(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSaved(false);
    setTestResult(null);
    try {
      await apiFetch('/admin/settings/models', {
        method: 'PUT',
        body: JSON.stringify({ embedModel, chatModel, curateModel: curateModel || chatModel }),
      });
      setSource('db');
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details?.errors)) {
        applyValidationErrors(err.details.errors as ModelValidationError[]);
      }
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Модели по задачам</h1>
      <p className="text-sm text-slate-600">
        Идентификаторы моделей OpenRouter. Выберите из списка или введите вручную — перед
        сохранением проверяется каталог OpenRouter.
        Текущий источник: <strong>{source ? trModelSource(source) : '…'}</strong>
        {catalogLoaded && (
          <>
            {' '}
            · в каталоге: {embedOptions.length} embed, {chatOptions.length} chat
          </>
        )}
      </p>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">Настройки сохранены в базе</Alert>}
      {testResult?.ok && (
        <Alert type="success">
          Тест пройден: {testResult.embed?.message}, {testResult.chat?.message}
        </Alert>
      )}
      {testResult && !testResult.ok && (
        <Alert type="error">
          <p className="font-medium mb-1">Тест не пройден</p>
          <ul className="text-xs space-y-0.5">
            {testResult.embed && <li>{testResult.embed.message}</li>}
            {testResult.chat && <li>{testResult.chat.message}</li>}
          </ul>
        </Alert>
      )}

      {envDefaults && (
        <Alert type="info">
          <p className="font-medium mb-1">Значения по умолчанию из .env (бесплатные :free)</p>
          <ul className="text-xs font-mono space-y-0.5">
            <li>embed: {envDefaults.embedModel}</li>
            <li>chat: {envDefaults.chatModel}</li>
            <li>curate: {envDefaults.curateModel}</li>
          </ul>
        </Alert>
      )}

      <Card title="Модели">
        <form onSubmit={onSave} className="space-y-4">
          <ModelPicker
            label="Эмбеддинги (индексация, RAG)"
            value={embedModel}
            onChange={setEmbedModel}
            options={embedOptions}
            listId="openrouter-embed-models"
            required
            error={fieldErrors.embedModel}
          />
          <ModelPicker
            label="Чат (общий)"
            value={chatModel}
            onChange={setChatModel}
            options={chatOptions}
            listId="openrouter-chat-models"
            required
            error={fieldErrors.chatModel}
          />
          <ModelPicker
            label="Курация новостей"
            value={curateModel}
            onChange={setCurateModel}
            options={chatOptions}
            listId="openrouter-curate-models"
            placeholder="Пусто — как чат"
            error={fieldErrors.curateModel}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Сохранить</Button>
            <Button type="button" variant="secondary" onClick={() => onValidate()}>
              Проверить в каталоге
            </Button>
            <Button type="button" variant="secondary" disabled={testing} onClick={onTestModels}>
              {testing ? 'Тест…' : 'Тест моделей (API)'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={resetting}
              onClick={onResetDefaults}
            >
              {resetting ? 'Сброс…' : 'Сбросить к .env'}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="KPPDF (только просмотр)">
        <KppdfBlock />
      </Card>
    </div>
  );
}

function KppdfBlock() {
  const [info, setInfo] = useState<{
    baseUrl: string;
    username: string;
    passwordConfigured: boolean;
    note: string;
  } | null>(null);

  useEffect(() => {
    apiFetch<{
      baseUrl: string;
      username: string;
      passwordConfigured: boolean;
      note: string;
    }>('/admin/settings/kppdf').then(setInfo);
  }, []);

  if (!info) return <p className="text-sm text-slate-500">Загрузка…</p>;

  return (
    <dl className="text-sm space-y-2">
      <div>
        <dt className="text-slate-500">URL API</dt>
        <dd className="font-mono text-xs break-all">{info.baseUrl}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Пользователь</dt>
        <dd>{info.username || '—'}</dd>
      </div>
      <div>
        <dt className="text-slate-500">Пароль в .env</dt>
        <dd>{info.passwordConfigured ? 'задан' : 'не задан'}</dd>
      </div>
      <p className="text-xs text-slate-500 mt-3">{info.note}</p>
    </dl>
  );
}
