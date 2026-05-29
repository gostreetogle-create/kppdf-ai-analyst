/** Parse Set-Cookie headers from fetch response (Node 18+). */
export function parseSetCookies(headers: Headers): Record<string, string> {
  const cookies: Record<string, string> = {};
  const rawList = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];

  for (const raw of rawList) {
    const part = raw.split(';')[0]?.trim();
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
