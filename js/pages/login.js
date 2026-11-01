import { api, tokens, ApiError } from '../api.js';
import { renderHeader, setLoading, alertEl } from '../ui.js';
import { redirectIfAuth, safeReturnUrl } from '../auth-guard.js';

renderHeader('login');
redirectIfAuth();

const form = document.getElementById('login-form');
const errBox = document.getElementById('login-error');
const email = document.getElementById('login-email');
const password = document.getElementById('login-password');
const submit = document.getElementById('login-submit');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.innerHTML = '';
  if (!email.value) { email.focus(); return; }
  if (!password.value) { password.focus(); return; }

  setLoading(submit, true);
  try {
    const res = await api.login({ email: email.value.trim(), password: password.value });
    tokens.save(res.accessToken, res.refreshToken);
    const returnUrl = safeReturnUrl(new URLSearchParams(location.search).get('returnUrl'));
    location.replace(returnUrl);
  } catch (err) {
    if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
      errBox.appendChild(alertEl({ variant: 'danger', text: err.message }));
      password.value = '';
      password.focus();
    } else {
      errBox.appendChild(alertEl({ variant: 'danger', text: err.message || 'The server is unavailable. Try again later.' }));
    }
  } finally {
    setLoading(submit, false);
  }
});