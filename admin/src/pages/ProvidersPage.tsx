import { FormEvent, useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { Alert, Button, Card, Input, Label } from '../components/ui';

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKeyMasked: string;
  isActive: boolean;
  isDefault: boolean;
}

export function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const [name, setName] = useState('OpenRouter');
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(true);

  function load() {
    apiFetch<{ providers: Provider[] }>('/admin/providers')
      .then((r) => setProviders(r.providers))
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'));
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/admin/providers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          type: 'openrouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey,
          isDefault,
          isActive: true,
        }),
      });
      setApiKey('');
      setMessage('Провайдер сохранён');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    }
  }

  async function setDefault(id: string) {
    await apiFetch(`/admin/providers/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isDefault: true }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Удалить провайдера?')) return;
    await apiFetch(`/admin/providers/${id}`, { method: 'DELETE' });
    load();
  }

  async function test(id: string) {
    setTestingId(id);
    setMessage('');
    try {
      const r = await apiFetch<{ ok: boolean; message: string }>(`/admin/providers/${id}/test`, {
        method: 'POST',
      });
      setMessage(r.ok ? r.message : `Ошибка: ${r.message}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка теста');
    } finally {
      setTestingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Провайдеры AI</h1>
      <p className="text-sm text-slate-600">
        API-ключи хранятся в MongoDB в зашифрованном виде. В списке показывается только маска (
        sk-...xxxx).
      </p>

      {error && <Alert type="error">{error}</Alert>}
      {message && <Alert type={message.startsWith('Ошибка') ? 'error' : 'success'}>{message}</Alert>}

      <Card title="Добавить OpenRouter">
        <form onSubmit={onCreate} className="space-y-4 max-w-lg">
          <div>
            <Label>Название</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>API ключ</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-..."
              required
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Сделать провайдером по умолчанию
          </label>
          <Button type="submit">Сохранить</Button>
        </form>
      </Card>

      <Card title="Список">
        {providers.length === 0 ? (
          <p className="text-slate-500 text-sm">Нет провайдеров. Добавьте ключ или задайте OPENROUTER_API_KEY в .env.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Название</th>
                  <th className="py-2 pr-4">Тип</th>
                  <th className="py-2 pr-4">Ключ</th>
                  <th className="py-2 pr-4">По умолч.</th>
                  <th className="py-2">Действия</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-medium">{p.name}</td>
                    <td className="py-3 pr-4">{p.type}</td>
                    <td className="py-3 pr-4 font-mono text-xs">{p.apiKeyMasked}</td>
                    <td className="py-3 pr-4">{p.isDefault ? '✓' : '—'}</td>
                    <td className="py-3 flex flex-wrap gap-2">
                      {!p.isDefault && (
                        <Button variant="secondary" onClick={() => setDefault(p.id)}>
                          По умолчанию
                        </Button>
                      )}
                      <Button variant="secondary" onClick={() => test(p.id)} disabled={testingId === p.id}>
                        {testingId === p.id ? 'Тест…' : 'Тест'}
                      </Button>
                      <Button variant="danger" onClick={() => remove(p.id)}>
                        Удалить
                      </Button>
                    </td>
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
