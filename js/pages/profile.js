import { api } from '../api.js';
import { renderHeader, toast, setLoading, fieldError, clearFieldError } from '../ui.js';
import { requireAuth } from '../auth-guard.js';
import { attachPhoneMask } from '../phone-mask.js';

requireAuth();
renderHeader('');

const form = document.getElementById('profile-form');
const submitBtn = document.getElementById('prof-submit');
const errorContainer = document.getElementById('profile-error');

const emailEl = document.getElementById('prof-email');
const genderEl = document.getElementById('prof-gender');
const nameInput = document.getElementById('prof-name');
const birthInput = document.getElementById('prof-birth');
const phoneInput = document.getElementById('prof-phone');

const phoneMask = attachPhoneMask(phoneInput);

async function loadProfile() {
  try {
    const data = await api.profile();
    
    emailEl.textContent = data.email || '—';
    genderEl.textContent = data.gender || '—';
    
    nameInput.value = data.fullName || '';
    birthInput.value = data.birthDate ? data.birthDate.split('T')[0] : '';
    if (data.phoneNumber) {
      phoneMask.setValue(data.phoneNumber);
    }
  } catch (e) {
    toast('Failed to load profile', 'danger');
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorContainer.innerHTML = ''; 
  
  if (!nameInput.value.trim()) {
    fieldError(nameInput, document.getElementById('prof-name-error'), 'The full name is required.');
    return;
  }

  const payload = {
    fullName: nameInput.value.trim(),
    birthDate: birthInput.value || null,
    phoneNumber: phoneMask.isValid() ? phoneInput.value : null
  };

  setLoading(submitBtn, true);
  try {
    await api.updateProfile(payload);
    toast('The profile is saved.', 'success');
  } catch (e) {
    if (e.code === 'VALIDATION_ERROR' && e.errors) {
      if (e.errors.fullName) fieldError(nameInput, document.getElementById('prof-name-error'), e.errors.fullName[0]);
      if (e.errors.birthDate) fieldError(birthInput, document.getElementById('prof-birth-error'), e.errors.birthDate[0]);
      if (e.errors.phoneNumber) fieldError(phoneInput, document.getElementById('prof-phone-error'), e.errors.phoneNumber[0]);
    } else {
      toast(e.message || 'Failed to save profile', 'danger');
    }
  } finally {
    setLoading(submitBtn, false);
  }
});

loadProfile();