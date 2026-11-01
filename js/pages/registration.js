import { api, tokens, ApiError } from '../api.js';
import { renderHeader, setLoading, alertEl, fieldError, clearAllErrors } from '../ui.js';
import { redirectIfAuth } from '../auth-guard.js';
import { attachPhoneMask } from '../phone-mask.js';

renderHeader('registration');
redirectIfAuth();

const form = document.getElementById('reg-form');
const errBox = document.getElementById('reg-error');
const nameInput = document.getElementById('reg-name');
const emailInput = document.getElementById('reg-email');
const passwordInput = document.getElementById('reg-password');
const birthInput = document.getElementById('reg-birth');
const phoneInput = document.getElementById('reg-phone');
const submit = document.getElementById('reg-submit');

const nameErr = document.getElementById('reg-name-error');
const emailErr = document.getElementById('reg-email-error');
const passwordErr = document.getElementById('reg-password-error');
const birthErr = document.getElementById('reg-birth-error');
const phoneErr = document.getElementById('reg-phone-error');

const phoneMask = attachPhoneMask(phoneInput);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASS_RE = /^(?=.*[A-Za-z])(?=.*\d).{6,64}$/;

function validate() {
  clearAllErrors(form);
  let ok = true;

  const fullName = nameInput.value.trim();
  if (!fullName) {
    fieldError(nameInput, nameErr, 'The full name is required.');
    ok = false;
  } else if (fullName.length > 100) {
    fieldError(nameInput, nameErr, 'The full name is required.');
    ok = false;
  }

  const email = emailInput.value.trim();
  if (!email || !EMAIL_RE.test(email)) {
    fieldError(emailInput, emailErr, 'The email address is invalid.');
    ok = false;
  }

  if (!PASS_RE.test(passwordInput.value)) {
    fieldError(passwordInput, passwordErr, 'The password must contain at least one letter and one digit.');
    ok = false;
  }

  if (!birthInput.value) {
    fieldError(birthInput, birthErr, 'The date of birth must be between 1900-01-01 and today.');
    ok = false;
  } else {
    const d = new Date(birthInput.value);
    const min = new Date('1900-01-01T00:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d < min || d > today) {
      fieldError(birthInput, birthErr, 'The date of birth must be between 1900-01-01 and today.');
      ok = false;
    }
  }

  if (!phoneMask.isValid()) {
    fieldError(phoneInput, phoneErr, 'The phone number must match the format +7 (xxx) xxx-xx-xx.');
    ok = false;
  }

  return ok;
}


const FIELD_MAP = {
  fullName: [nameInput, nameErr],
  email: [emailInput, emailErr],
  password: [passwordInput, passwordErr],
  birthDate: [birthInput, birthErr],
  phoneNumber: [phoneInput, phoneErr],
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errBox.innerHTML = '';
  if (!validate()) return;

  const genderInput = form.querySelector('input[name="gender"]:checked');

  
  const body = {
    fullName: nameInput.value.trim(),
    email: emailInput.value.trim(),
    password: passwordInput.value,
    birthDate: birthInput.value,
    gender: genderInput ? genderInput.value : null,
    phoneNumber: phoneInput.value,
  };

  setLoading(submit, true);
  try {
    const res = await api.register(body);
    tokens.save(res.accessToken, res.refreshToken);
    location.replace('index.html');
  } catch (err) {
    if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') {
      errBox.appendChild(alertEl({ variant: 'danger', text: err.message }));
      emailInput.setAttribute('aria-invalid', 'true');
    } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.errors) {
      // errors: { field: [messages] } 或 { field: message }，两种格式都兼容
      Object.entries(err.errors).forEach(([field, msgs]) => {
        const target = FIELD_MAP[field];
        if (!target) return;
        const [input, errEl] = target;
        const text = Array.isArray(msgs) ? msgs[0] : String(msgs);
        fieldError(input, errEl, text);
      });
      if (!Object.keys(err.errors).some(k => FIELD_MAP[k])) {
        errBox.appendChild(alertEl({ variant: 'danger', text: err.message }));
      }
    } else {
      errBox.appendChild(alertEl({
        variant: 'danger',
        text: (err && err.message) || 'The server is unavailable. Try again later.',
      }));
    }
  } finally {
    setLoading(submit, false);
  }
});