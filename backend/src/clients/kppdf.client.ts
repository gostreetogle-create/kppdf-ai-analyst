import { config } from '../config';
import { parseSetCookies } from '../utils/http';

const ACCESS_COOKIE = 'kppdf_access_token';
const REFRESH_COOKIE = 'kppdf_refresh_token';

export interface KppdfPaginated<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface KppdfProduct {
  _id: string;
  name: string;
  description?: string;
  categoryId?: string;
  sku?: string;
  subcategory?: string;
  purpose?: string;
  materials?: string;
}

export interface KppdfCategory {
  _id: string;
  name: string;
  fullPath?: string;
  sortOrder?: number;
}

interface Session {
  accessToken: string;
  refreshToken: string;
}

let session: Session | null = null;

async function login(): Promise<Session> {
  const { username, password, baseUrl } = {
    username: config.kppdf.username,
    password: config.kppdf.password,
    baseUrl: config.kppdf.baseUrl,
  };

  if (!username || !password) {
    throw new Error('[kppdf] KPPDF_AUTH_USERNAME and KPPDF_AUTH_PASSWORD required');
  }

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[kppdf] login failed ${res.status}: ${text}`);
  }

  const cookies = parseSetCookies(res.headers);
  const accessToken = cookies[ACCESS_COOKIE];
  const refreshToken = cookies[REFRESH_COOKIE];

  if (!accessToken) {
    throw new Error('[kppdf] login ok but no access token in Set-Cookie');
  }

  session = { accessToken, refreshToken: refreshToken || '' };
  console.log('[kppdf] authenticated as', username);
  return session;
}

async function refresh(): Promise<Session> {
  if (!session?.refreshToken) {
    return login();
  }

  const res = await fetch(`${config.kppdf.baseUrl}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${REFRESH_COOKIE}=${encodeURIComponent(session.refreshToken)}`,
    },
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  });

  if (!res.ok) {
    console.warn('[kppdf] refresh failed, re-login');
    session = null;
    return login();
  }

  const cookies = parseSetCookies(res.headers);
  session = {
    accessToken: cookies[ACCESS_COOKIE] || session.accessToken,
    refreshToken: cookies[REFRESH_COOKIE] || session.refreshToken,
  };
  return session;
}

async function getSession(): Promise<Session> {
  if (!session) return login();
  return session;
}

async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = async (token: string) => {
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return fetch(`${config.kppdf.baseUrl}${path}`, { ...init, headers });
  };

  let { accessToken } = await getSession();
  let res = await doFetch(accessToken);

  if (res.status === 401) {
    ({ accessToken } = await refresh());
    res = await doFetch(accessToken);
  }

  return res;
}

async function paginateAll<T>(path: string, limit = 100): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (true) {
    const res = await authedFetch(`${path}?page=${page}&limit=${limit}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[kppdf] GET ${path} failed ${res.status}: ${text}`);
    }

    const body = (await res.json()) as KppdfPaginated<T>;
    const items = body.data ?? [];
    all.push(...items);

    if (items.length < limit || page >= (body.totalPages || 1)) break;
    page++;
    if (page > 500) break;
  }

  return all;
}

export async function initKppdfSession(): Promise<void> {
  if (config.kppdf.username && config.kppdf.password) {
    await login();
  } else {
    console.warn('[kppdf] credentials not set — sync disabled until KPPDF_AUTH_* configured');
  }
}

export const kppdfClient = {
  getProducts(): Promise<KppdfProduct[]> {
    return paginateAll<KppdfProduct>('/directories/products');
  },

  getCategories(): Promise<KppdfCategory[]> {
    return paginateAll<KppdfCategory>('/directories/categories');
  },
};
