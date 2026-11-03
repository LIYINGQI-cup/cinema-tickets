import { getConfig } from './config.js';

let tz = 'Asia/Tomsk';
export async function initTz() {
  try {
    const c = await getConfig();
    if (c.timeZone) tz = c.timeZone;
  } catch {}
}

function safeDate(iso) {
  if (!iso) return new Date();
  if (typeof iso === 'string' && /^\d+$/.test(iso)) {
    return new Date(Number(iso) * 1000);
  }
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function money(v) {
  const n = Number(v) || 0;
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} ₽`;
}
export function discountMoney(v) { return `−${money(Math.abs(v))}`; }

export function dateOnly(iso) {
  return safeDate(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: tz,
  });
}
export function dateTime(iso) {
  return safeDate(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).replace(',', ' ·');
}
export function shortDate(iso) {
  return safeDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz });
}
export function weekdayShort(iso) {
  return safeDate(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone: tz });
}
export function timeOnly(iso) {
  return safeDate(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  });
}
export function sessionDateTime(iso) {
  return `${weekdayShort(iso)}, ${shortDate(iso)} · ${timeOnly(iso)}`;
}
export function timeRange(startIso, endIso) { return `${timeOnly(startIso)}-${timeOnly(endIso)}`; }
export function duration(minutes) { return `${Math.floor(minutes / 60)} h ${minutes % 60} min`; }
export function ticketsCount(n) { return `${n} ticket${n === 1 ? '' : 's'}`; }
export function timerText(msLeft) {
  const t = Math.max(0, Math.floor(msLeft / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export const AGE_DISPLAY = { Age0: '0+', Age6: '6+', Age12: '12+', Age16: '16+', Age18: '18+' };
export const FORMAT_DISPLAY = { TwoD: '2D', ThreeD: '3D', Imax: 'IMAX' };
export const GENRE_DISPLAY = { SciFi: 'Sci-Fi' };
export const GENRES = ['Action','Adventure','Animation','Comedy','Crime','Documentary','Drama','Family','Fantasy','Horror','Romance','SciFi','Thriller'];
export const AGE_RATINGS = ['Age0','Age6','Age12','Age16','Age18'];
export const SORTINGS = {
  TitleAsc: 'Title: A–Z', TitleDesc: 'Title: Z–A',
  RatingDesc: 'Rating: high to low', RatingAsc: 'Rating: low to high',
  ReleaseDateDesc: 'Release date: newest first', ReleaseDateAsc: 'Release date: oldest first',
};
export const ageLabel = v => AGE_DISPLAY[v] || v;
export const formatLabel = v => FORMAT_DISPLAY[v] || v;
export const genreLabel = v => GENRE_DISPLAY[v] || v;