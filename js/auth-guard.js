import { tokens } from './api.js';

export function requireAuth() {
  if (!tokens.access) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    location.replace(`login.html?returnUrl=${returnUrl}`);
    return false;
  }
  return true;
}
export function redirectIfAuth() {
  if (tokens.access) { location.replace('index.html'); return true; }
  return false;
}
export function safeReturnUrl(raw, fallback = 'index.html') {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, location.origin);
    if (url.origin !== location.origin) return fallback;
    if (!/\.html?(\?|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}