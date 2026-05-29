/** Stable slug from KPPDF category fullPath (Category has no slug field). */
export function slugFromFullPath(fullPath: string | undefined, fallbackName: string): string {
  const raw = (fullPath || `/${fallbackName}`).replace(/^\//, '');
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0400-\u04ff-]/g, '');
}
