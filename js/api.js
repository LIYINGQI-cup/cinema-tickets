const BASE = 'https://api.cinema.int.hardcoder.ru';
const TOKEN_KEY = 'cinema.accessToken';
const REFRESH_KEY = 'cinema.refreshToken';

export const tokens = {
  get access() { return localStorage.getItem(TOKEN_KEY); },
  get refresh() { return localStorage.getItem(REFRESH_KEY); },
  save(access, refresh) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(status, code, message, errors = null, affectedIds = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.affectedIds = affectedIds;
  }
}

let refreshPromise = null;

async function doRefresh() {
  const rt = tokens.refresh;
  if (!rt) throw new Error('NO_REFRESH_TOKEN');
  const res = await fetch(`${BASE}/api/account/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  });
  if (!res.ok) {
    tokens.clear();
    throw new Error('REFRESH_FAILED');
  }
  const data = await res.json();
  tokens.save(data.accessToken, data.refreshToken);
  return data.accessToken;
}

export async function apiFetch(path, options = {}, retried = false) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'The server is unavailable. Try again later.');
  }

  // 401 只重试一次，避免死循环
  if (res.status === 401 && !retried && tokens.refresh) {
    try {
      if (!refreshPromise) {
        refreshPromise = doRefresh().finally(() => { refreshPromise = null; });
      }
      await refreshPromise;
      return apiFetch(path, options, true);
    } catch {
      tokens.clear();
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      location.replace(`login.html?returnUrl=${returnUrl}`);
      return new Promise(() => {});
    }
  }

  if (res.status >= 500) {
    throw new ApiError(res.status, 'SERVER_ERROR', 'The server is unavailable. Try again later.');
  }

  if (!res.ok) {
    let problem = null;
    try { problem = await res.json(); } catch {}
    throw new ApiError(
      res.status,
      problem?.code || 'UNKNOWN',
      problem?.detail || problem?.title || 'Request failed',
      problem?.errors || null,
      problem?.affectedIds || null,
    );
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  config: () => apiFetch('/api/config'),

  login: (body) => apiFetch('/api/account/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => apiFetch('/api/account/register', { method: 'POST', body: JSON.stringify(body) }),
  logout: (refreshToken) => apiFetch('/api/account/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) }),
  profile: () => apiFetch('/api/account/profile'),
  updateProfile: (body) => apiFetch('/api/account/profile', { method: 'PUT', body: JSON.stringify(body) }),

  movies: (qs) => apiFetch(`/api/movies?${qs}`),
  movie: (id) => apiFetch(`/api/movies/${id}`),
  sessions: (id, date) => apiFetch(`/api/movies/${id}/sessions?date=${encodeURIComponent(date)}`),
  reviews: (id, page) => apiFetch(`/api/movies/${id}/reviews?page=${page}`),
  reviewsCheck: (id) => apiFetch(`/api/movies/${id}/reviews/check`),
  postReview: (id, body) => apiFetch(`/api/movies/${id}/reviews`, { method: 'POST', body: JSON.stringify(body) }),
  updateReview: (id, body) => apiFetch(`/api/reviews/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteReview: (id) => apiFetch(`/api/reviews/${id}`, { method: 'DELETE' }),

  session: (id) => apiFetch(`/api/sessions/${id}`),
  seats: (id) => apiFetch(`/api/sessions/${id}/seats`),

  cart: () => apiFetch('/api/cart'),
  addToCart: (body) => apiFetch('/api/cart/items', { method: 'POST', body: JSON.stringify(body) }),
  removeCartItem: (id) => apiFetch(`/api/cart/items/${id}`, { method: 'DELETE' }),
  clearCart: () => apiFetch('/api/cart', { method: 'DELETE' }),

  checkPromo: (code) => apiFetch('/api/promocodes/check', { method: 'POST', body: JSON.stringify({ code }) }),

  createBookings: (body) => apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(body) }),
  bookings: () => apiFetch('/api/bookings'),
  booking: (id) => apiFetch(`/api/bookings/${id}`),
  cancelBooking: (id) => apiFetch(`/api/bookings/${id}/cancel`, { method: 'POST' }),
};