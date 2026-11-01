const DIGITS_MAX = 10;

export function attachPhoneMask(input) {
  let digits = '';

  function render() {
    let out = '+7 (';
    for (let i = 0; i < digits.length; i++) {
      if (i === 3) out += ') ';
      if (i === 6) out += '-';
      if (i === 8) out += '-';
      out += digits[i];
    }
    input.value = out;
    input.placeholder = '+7 (___) ___-__-__';
  }

  function normalize(raw) {
    let d = raw.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d.startsWith('7')) d = d.slice(1);
    return d.slice(0, DIGITS_MAX);
  }

  input.addEventListener('input', () => {
    digits = normalize(input.value);
    render();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    digits = normalize(text);
    render();
  });

  return {
    setValue(v) { digits = normalize(v || ''); render(); },
    getValue() { return input.value; },
    isValid() { return digits.length === DIGITS_MAX; },
  };
}