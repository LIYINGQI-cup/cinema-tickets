import { tokens, api } from './api.js';

export const isAuthorized = () => !!tokens.access;

export function renderHeader(activePage) {
  const header = document.querySelector('.l-header');
  if (!header) return;
  header.querySelectorAll('.c-nav__link').forEach(a => {
    if (a.dataset.page === activePage) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  const userArea = header.querySelector('.c-header__user');
  if (!userArea) return;

  if (isAuthorized()) {
    userArea.innerHTML = `
      <a class="c-header__email" href="profile.html">
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="./kit/icons.svg#icon-user"></use></svg>
        <span data-email>…</span>
      </a>
      <button class="c-btn c-btn--ghost c-btn--sm" type="button" data-logout>
        <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="./kit/icons.svg#icon-logout"></use></svg>
        Log out
      </button>`;
    api.profile().then(p => {
      const el = userArea.querySelector('[data-email]');
      if (el) el.textContent = p.email;
    }).catch(() => {});
    userArea.querySelector('[data-logout]').addEventListener('click', async () => {
      try { await api.logout(tokens.refresh); } catch {}
      tokens.clear();
      location.replace('index.html');
    });
  } else {
    userArea.innerHTML = `
      <a class="c-btn c-btn--secondary c-btn--sm" href="login.html">Log in</a>
      <a class="c-btn c-btn--primary c-btn--sm" href="registration.html">Register</a>`;
  }

  updateCartCounter();
}

export async function updateCartCounter() {
  const counter = document.querySelector('.c-counter');
  if (!counter) return;
  if (!isAuthorized()) { counter.hidden = true; return; }
  try {
    const cart = await api.cart();
    const items = cart.items || cart.tickets || [];
    if (items.length > 0) { counter.textContent = items.length; counter.hidden = false; }
    else counter.hidden = true;
  } catch { counter.hidden = true; }
}

export function toast(text, variant = 'info') {
  let stack = document.querySelector('.c-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'c-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  const icon = variant === 'danger' ? 'icon-error' : variant === 'success' ? 'icon-check' : 'icon-info';
  const el = document.createElement('div');
  el.className = `c-toast c-toast--${variant}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <svg class="c-icon c-toast__icon" aria-hidden="true"><use href="./kit/icons.svg#${icon}"></use></svg>
    <p class="c-toast__text"></p>
    <button class="c-btn c-btn--ghost c-btn--icon c-btn--sm c-toast__close" type="button" aria-label="Close">
      <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="./kit/icons.svg#icon-close"></use></svg>
    </button>`;
  el.querySelector('.c-toast__text').textContent = text;
  el.querySelector('.c-toast__close').addEventListener('click', () => el.remove());
  stack.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

export function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); }
  else { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); }
}

export function fieldError(input, errorEl, message) {
  input.setAttribute('aria-invalid', 'true');
  const span = errorEl.querySelector('span') || errorEl;
  span.textContent = message;
  errorEl.hidden = false;
  if (errorEl.id) input.setAttribute('aria-describedby', errorEl.id);
}
export function clearFieldError(input, errorEl) {
  input.removeAttribute('aria-invalid');
  errorEl.hidden = true;
  if (errorEl.id) input.removeAttribute('aria-describedby');
}
export function clearAllErrors(container) {
  container.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  container.querySelectorAll('.c-field__error').forEach(el => { el.hidden = true; });
}

export function alertEl({ variant = 'danger', text = '', action = null, role = 'alert' }) {
  const el = document.createElement('div');
  el.className = `c-alert c-alert--${variant}`;
  el.setAttribute('role', role);
  const icon = variant === 'danger' ? 'icon-error'
    : variant === 'success' ? 'icon-check'
    : variant === 'warning' ? 'icon-warning' : 'icon-info';
  el.innerHTML = `
    <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="./kit/icons.svg#${icon}"></use></svg>
    <div class="c-alert__body"><p></p></div>`;
  el.querySelector('p').textContent = text;
  if (action) {
    const wrap = document.createElement('div');
    wrap.className = 'c-alert__action';
    wrap.appendChild(action);
    el.appendChild(wrap);
  }
  return el;
}

export function linkBtn(href, label, variant = 'secondary') {
  const a = document.createElement('a');
  a.className = `c-btn c-btn--${variant} c-btn--sm`;
  a.href = href;
  a.textContent = label;
  return a;
}

export function emptyEl({ title, text = '', action = null, error = false, icon = 'icon-film' }) {
  const el = document.createElement('div');
  el.className = `c-empty${error ? ' c-empty--error' : ''}`;
  el.innerHTML = `
    <div class="c-empty__icon">
      <svg class="c-icon c-icon--lg" aria-hidden="true"><use href="./kit/icons.svg#${icon}"></use></svg>
    </div>
    <h2 class="c-empty__title"></h2>
    ${text ? '<p class="c-empty__text"></p>' : ''}`;
  el.querySelector('.c-empty__title').textContent = title;
  if (text) el.querySelector('.c-empty__text').textContent = text;
  if (action) {
    const wrap = document.createElement('div');
    wrap.className = 'c-empty__action';
    wrap.appendChild(action);
    el.appendChild(wrap);
  }
  return el;
}