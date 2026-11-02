import { api, ApiError } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, updateCartCounter } from '../ui.js';
import { duration, genreLabel, GENRES, AGE_RATINGS, SORTINGS, shortDate } from '../format.js';

renderHeader('movies');

const params = new URLSearchParams(location.search);
const grid = document.getElementById('movies-grid');
const countEl = document.getElementById('movies-count');
const pagination = document.getElementById('pagination');

function initFilters() {
  const genresPanel = document.getElementById('genres-panel');
  genresPanel.innerHTML = GENRES.map(g => `
    <label class="c-check c-multiselect__option">
      <input class="c-check__input" type="checkbox" name="genres" value="${g}">
      <span class="c-check__box" aria-hidden="true"></span><span>${genreLabel(g)}</span>
    </label>
  `).join('');

  const agesPanel = document.getElementById('ages-panel');
  agesPanel.innerHTML = AGE_RATINGS.map(a => `
    <label class="c-check c-multiselect__option">
      <input class="c-check__input" type="checkbox" name="ageRatings" value="${a}">
      <span class="c-check__box" aria-hidden="true"></span><span>${a.replace('Age', '')}+</span>
    </label>
  `).join('');

  const sorting = document.getElementById('filter-sorting');
  sorting.innerHTML = Object.entries(SORTINGS).map(([val, label]) => `<option value="${val}">${label}</option>`).join('');

  params.getAll('genres').forEach(v => {
    const el = genresPanel.querySelector(`input[value="${v}"]`);
    if (el) el.checked = true;
  });
  params.getAll('ageRatings').forEach(v => {
    const el = agesPanel.querySelector(`input[value="${v}"]`);
    if (el) el.checked = true;
  });
  if (params.get('sorting')) sorting.value = params.get('sorting');
  if (params.get('nowShowing') === 'true') document.getElementById('filter-now').checked = true;

  updateMultiselectLabel('filter-genres', params.getAll('genres'));
  updateMultiselectLabel('filter-ages', params.getAll('ageRatings'));
}

function updateMultiselectLabel(filterId, selectedValues) {
  const valueEl = document.querySelector(`#${filterId} .c-multiselect__value`);
  if (!valueEl) return;
  if (selectedValues.length === 0) valueEl.textContent = 'Any';
  else if (selectedValues.length <= 2) valueEl.textContent = selectedValues.map(v => v.replace('Age', '') + (v.includes('Age') ? '+' : '')).join(', ');
  else valueEl.textContent = `${selectedValues.length} selected`;
}

async function init() {
  initFilters();
  const config = await getConfig();
  const pageSize = config.moviesPageSize || 8;

  const dateSelect = document.getElementById('filter-date');
  const today = new Date();
  for (let i = 0; i < (config.scheduleDaysAhead || 7); i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const val = d.toISOString().split('T')[0];
    const label = i === 0 ? 'Today' : shortDate(val);
    dateSelect.innerHTML += `<option value="${val}">${label}</option>`;
  }
  if (params.get('date')) dateSelect.value = params.get('date');

  loadMovies(pageSize);
}

function showSkeletons(n) {
  grid.innerHTML = Array.from({ length: n }, () => `
    <div class="l-stack l-stack--sm" aria-hidden="true">
      <span class="c-skeleton c-skeleton--poster"></span>
      <span class="c-skeleton c-skeleton--title"></span>
      <span class="c-skeleton c-skeleton--text"></span>
    </div>`).join('');
}

async function loadMovies(pageSize) {
  showSkeletons(pageSize);
  
  const qs = new URLSearchParams(params);
  if (!qs.has('page')) qs.set('page', '1');
  const currentPage = Number(qs.get('page'));

  try {
    const data = await api.movies(qs.toString());
    const movies = data.items || data.movies || [];
    
    countEl.textContent = `${data.totalItems} ${data.totalItems === 1 ? 'movie' : 'movies'}`;
    renderMovies(movies);
    renderPagination(data.totalItems, currentPage, pageSize);
    grid.setAttribute('aria-busy', 'false');
  } catch (e) {
    grid.innerHTML = '';
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `<div class="c-empty c-empty--error" style="grid-column:1/-1">
      <div class="c-empty__icon"><svg class="c-icon c-icon--lg"><use href="./kit/icons.svg#icon-error"></use></svg></div>
      <h2 class="c-empty__title">${e.message || 'The server is unavailable.'}</h2>
      <div class="c-empty__action"><a class="c-btn c-btn--secondary" href="index.html">Go to catalog</a></div>
    </div>`;
  }
}

function renderMovies(movies) {
  if (!movies.length) {
    grid.innerHTML = `
      <div class="c-empty" style="grid-column:1/-1">
        <div class="c-empty__icon"><svg class="c-icon c-icon--lg"><use href="./kit/icons.svg#icon-film"></use></svg></div>
        <h2 class="c-empty__title">No movies match the filters</h2>
        <p class="c-empty__text">Change the filters or reset them to see all movies.</p>
        <div class="c-empty__action"><a class="c-btn c-btn--secondary" href="index.html">Reset filters</a></div>
      </div>`;
    return;
  }

  grid.innerHTML = movies.map(m => {
    const comingSoon = m.releaseDate && new Date(m.releaseDate) > new Date();
    const ratingHtml = m.rating != null
      ? `<div class="c-stars c-stars--sm" style="--rating: ${m.rating}">
           <span class="c-stars__icons" role="img" aria-label="Rating ${m.rating} out of 10"></span>
           <span class="c-stars__value">${m.rating.toFixed(2)}</span>
           <span class="c-stars__count">${m.reviewsCount} reviews</span>
         </div>`
      : `<div class="c-stars c-stars--sm"><span class="c-stars__none">No ratings yet</span></div>`;

    return `
      <article class="c-movie-card">
        <div class="c-movie-card__media">
          <div class="c-poster c-poster--md">
            <img class="c-poster__img" src="${m.posterUrl}" alt="" width="400" height="600">
          </div>
          ${comingSoon ? `<span class="c-badge c-badge--info c-movie-card__badge">Coming soon · ${shortDate(m.releaseDate)}</span>` : ''}
        </div>
        <h2 class="c-movie-card__title">
          <a class="c-movie-card__link" href="movie.html?id=${m.id}">${m.title}</a>
        </h2>
        <p class="c-movie-card__meta">${m.genres.map(genreLabel).join(', ')} · ${duration(m.durationMinutes)}</p>
        ${ratingHtml}
      </article>`;
  }).join('');
}

function renderPagination(total, current, pageSize) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) { pagination.innerHTML = ''; return; }
  const links = [];
  
  const mk = (page, label, extra = '') => {
    const p = new URLSearchParams(params);
    p.set('page', page);
    return `<a class="c-pagination__link" href="index.html?${p}" ${extra}>${label}</a>`;
  };

  links.push(current > 1
    ? mk(current - 1, `<svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-left"></use></svg>Previous`)
    : `<a class="c-pagination__link" aria-disabled="true"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-left"></use></svg>Previous</a>`);
  
  for (let i = 1; i <= pages; i++) {
    links.push(mk(i, i, i === current ? 'aria-current="page"' : ''));
  }
  
  links.push(current < pages
    ? mk(current + 1, `Next<svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-right"></use></svg>`)
    : `<a class="c-pagination__link" aria-disabled="true">Next<svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-right"></use></svg></a>`);
  
  pagination.innerHTML = links.join('');
}

init();