const TOKEN_KEY = 'ai_admin_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(path, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };

  if (!res.ok) {
    throw new ApiError(data.error || res.statusText || 'Ошибка запроса', res.status, data);
  }

  return data as T;
}

export function login(username: string, password: string) {
  return apiFetch<{ token: string; user: { username: string } }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
