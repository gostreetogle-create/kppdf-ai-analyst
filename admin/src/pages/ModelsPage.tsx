import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Button, Card, Input, Label } from '../components/ui';
import { trModelSource } from '../locale';

export function ModelsPage() {
  const [embedModel, setEmbedModel] = useState('');
  const [chatModel, setChatModel] = useState('');
  const [curateModel, setCurateModel] = useState('');
  const [envDefaults, setEnvDefaults] = useState<{
    embedModel: string;
    chatModel: string;
    curateModel: string;
  } | null>(null);
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [resetting, setResetting] = useState(false);

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

  useEffect(() => {
    loadModels().catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }, []);

  async function onResetDefaults() {
    setError('');
    setSaved(false);
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
    setSaved(false);
    try {
      await apiFetch('/admin/settings/models', {
        method: 'PUT',
        body: JSON.stringify({ embedModel, chatModel, curateModel: curateModel || chatModel }),
      });
      setSource('db');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Модели по задачам</h1>
      <p className="text-sm text-slate-600">
        Идентификаторы моделей OpenRouter (например{' '}
        <code className="bg-slate-100 px-1 rounded text-xs">meta-llama/llama-3.3-70b-instruct:free</code>
        ,{' '}
        <code className="bg-slate-100 px-1 rounded text-xs">nvidia/llama-nemotron-embed-vl-1b-v2:free</code>
        ).
        Текущий источник: <strong>{source ? trModelSource(source) : '…'}</strong>
      </p>

      {error && <Alert type="error">{error}</Alert>}
      {saved && <Alert type="success">Настройки сохранены в базе</Alert>}

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
          <div>
            <Label>Эмбеддинги (индексация, RAG)</Label>
            <Input value={embedModel} onChange={(e) => setEmbedModel(e.target.value)} required />
          </div>
          <div>
            <Label>Чат (общий)</Label>
            <Input value={chatModel} onChange={(e) => setChatModel(e.target.value)} required />
          </div>
          <div>
            <Label>Курация новостей</Label>
            <Input
              value={curateModel}
              onChange={(e) => setCurateModel(e.target.value)}
              placeholder="Пусто — как чат"
            />
          </div>
          <Button type="submit">Сохранить</Button>
          <Button
            type="button"
            variant="secondary"
            disabled={resetting}
            onClick={onResetDefaults}
            className="ml-2"
          >
            {resetting ? 'Сброс…' : 'Сбросить к .env (бесплатные)'}
          </Button>
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
