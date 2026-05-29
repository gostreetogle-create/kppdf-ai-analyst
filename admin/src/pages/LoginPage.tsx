import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, Input, Label } from '../components/ui';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card title="Вход в админку">
          <p className="text-sm text-slate-600 mb-4">
            Логин и пароль задаются в .env:{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">ADMIN_USERNAME</code> /{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">ADMIN_PASSWORD</code>
          </p>
          {error && <Alert type="error">{error}</Alert>}
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Логин</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <Label>Пароль</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Вход…' : 'Войти'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
