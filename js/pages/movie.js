import { api } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, isAuthorized } from '../ui.js';
import { dateOnly, duration, genreLabel, ageLabel, formatLabel, shortDate, weekdayShort } from '../format.js';

renderHeader('movies');

const params = new URLSearchParams(location.search);
const movieId = params.get('id');
const main = document.getElementById('main-content');

async function init() {
  if (!movieId) return renderError('The movie was not found.');

  try {
    const config = await getConfig();
    const dateParam = params.get('date');
    
    const [movie, reviewsData, checkData] = await Promise.all([
      api.movie(movieId),
      api.reviews(movieId, 1),
      isAuthorized() ? api.reviewsCheck(movieId) : Promise.resolve(null)
    ]);

    const currentDate = dateParam || (movie.sessionDates && movie.sessionDates[0]);
    
    let sessions = [];
    if (currentDate) {
      sessions = await api.sessions(movieId, currentDate);
    }

    renderMovie(movie, sessions, currentDate, config);
    renderReviews(reviewsData, checkData, movie);

  } catch (e) {
    if (e.code === 'NOT_FOUND') renderError('The movie was not found.');
    else renderError(e.message || 'Error loading movie');
  }
}

function renderError(msg) {
  main.innerHTML = `
    <div class="l-container l-stack l-stack--lg">
      <div class="c-empty c-empty--error">
        <div class="c-empty__icon"><svg class="c-icon c-icon--lg"><use href="./kit/icons.svg#icon-error"></use></svg></div>
        <h2 class="c-empty__title">${msg}</h2>
        <div class="c-empty__action"><a class="c-btn c-btn--secondary" href="index.html">All movies</a></div>
      </div>
    </div>`;
}

function renderMovie(movie, sessions, selectedDate, config) {
  const comingSoon = new Date(movie.releaseDate) > new Date();
  
  const ratingHtml = movie.rating != null
    ? `<div class="c-stars c-stars--lg" style="--rating: ${movie.rating}">
         <span class="c-stars__icons" role="img" aria-label="Rating ${movie.rating}"></span>
         <span class="c-stars__value">${movie.rating.toFixed(2)}</span>
         <span class="c-stars__count">${movie.reviewsCount} reviews</span>
       </div>`
    : `<div class="c-stars c-stars--lg"><span class="c-stars__none">No ratings yet</span></div>`;

  let html = `
    <div class="l-container l-stack l-stack--lg">
      <a class="c-back-link" href="index.html"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-left"></use></svg>All movies</a>
      
      <section class="l-media">
        <div class="c-poster c-poster--lg"><img class="c-poster__img" src="${movie.posterUrl}" alt="" width="400" height="600"></div>
        <div class="l-stack">
          <h1>${movie.title}</h1>
          <div class="l-cluster">
            <span class="c-age">${ageLabel(movie.ageRating)}</span>
            ${movie.genres.map(g => `<span class="c-badge c-badge--neutral">${genreLabel(g)}</span>`).join('')}
          </div>
          ${ratingHtml}
          <p>${movie.description}</p>
          <dl class="c-dl">
            <div class="c-dl__row"><dt class="c-dl__term">Director</dt><dd class="c-dl__desc">${movie.director}</dd></div>
            <div class="c-dl__row"><dt class="c-dl__term">Cast</dt><dd class="c-dl__desc">${(movie.cast || []).join(', ')}</dd></div>
            <div class="c-dl__row"><dt class="c-dl__term">Country</dt><dd class="c-dl__desc">${movie.country}</dd></div>
            <div class="c-dl__row"><dt class="c-dl__term">Duration</dt><dd class="c-dl__desc">${duration(movie.durationMinutes)}</dd></div>
            <div class="c-dl__row"><dt class="c-dl__term">Release date</dt><dd class="c-dl__desc">${dateOnly(movie.releaseDate)}</dd></div>
          </dl>
        </div>
      </section>

      <section class="l-section">
        <div class="l-section__header"><h2 class="l-section__title">Schedule</h2></div>
  `;

  if (comingSoon) {
    html += `<div class="c-alert c-alert--info"><svg class="c-icon c-alert__icon"><use href="./kit/icons.svg#icon-calendar"></use></svg><div class="c-alert__body"><p>Sessions will be available from ${dateOnly(movie.releaseDate)}.</p></div></div>`;
  } else {
    const dates = movie.sessionDates || [];
    if (dates.length === 0) {
      html += `<div class="c-empty"><h2 class="c-empty__title">There are no sessions in the next ${config.scheduleDaysAhead} days.</h2></div>`;
    } else {
      html += `<nav class="c-date-tabs" aria-label="Session dates">`;
      const scheduleDays = config.scheduleDaysAhead || 7;
      for (let i = 0; i < scheduleDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const hasSession = dates.includes(dStr);
        const isSel = dStr === selectedDate;
        const label = i === 0 ? 'Today' : weekdayShort(dStr);
        const dateLabel = shortDate(dStr); 

        if (hasSession) {
          html += `<a class="c-date-tabs__tab" href="movie.html?id=${movieId}&date=${dStr}" ${isSel ? 'aria-current="date"' : ''}><span class="c-date-tabs__day">${label}</span><span class="c-date-tabs__date">${dateLabel}</span></a>`;
        } else {
          html += `<a class="c-date-tabs__tab" aria-disabled="true"><span class="c-date-tabs__day">${label}</span><span class="c-date-tabs__date">${dateLabel}</span></a>`;
        }
      }
      html += `</nav>`;

      const formats = ['Imax', 'ThreeD', 'TwoD'];
      html += `<div class="l-stack l-stack--lg">`;
      formats.forEach(f => {
        const fmtSessions = sessions.filter(s => s.format === f);
        if (!fmtSessions.length) return;
        
        const halls = [...new Set(fmtSessions.map(s => s.hall.name))].join(', ');
        html += `
          <section class="c-session-group">
            <header class="c-session-group__header">
              <span class="c-format">${formatLabel(f)}</span>
              <span class="c-session-group__halls">${halls}</span>
            </header>
            <div class="c-session-group__list">
              ${fmtSessions.map(s => {
                const time = new Date(s.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: config.timeZone });
                return s.isBookingOpen
                  ? `<a class="c-session" href="session.html?id=${s.id}"><span class="c-session__time">${time}</span><span class="c-session__hall">${s.hall.name}</span><span class="c-session__price">from ${s.prices.standard} ₽</span></a>`
                  : `<a class="c-session" aria-disabled="true"><span class="c-session__time">${time}</span><span class="c-session__hall">${s.hall.name}</span><span class="c-session__price">Booking closed</span></a>`;
              }).join('')}
            </div>
          </section>
        `;
      });
      html += `</div>`;
    }
  }
  
  html += `</section><section class="l-section" id="reviews-section"></section></div>`;
  main.innerHTML = html;
}

function renderReviews(data, checkData, movie) {
  const sec = document.getElementById('reviews-section');
  const count = data.totalItems || 0;
  
  let html = `
    <div class="l-section__header">
      <h2 class="l-section__title">Reviews <span class="l-section__count">${count}</span></h2>
    </div>
  `;

  if (!isAuthorized()) {
    html += `<div class="c-alert c-alert--info" role="status">
      <svg class="c-icon c-alert__icon"><use href="./kit/icons.svg#icon-info"></use></svg>
      <div class="c-alert__body"><p>Log in to leave a review.</p></div>
      <div class="c-alert__action"><a class="c-btn c-btn--secondary c-btn--sm" href="login.html?returnUrl=${encodeURIComponent(location.pathname + location.search)}">Log in</a></div>
    </div>`;
  } else if (checkData) {
    if (checkData.status === 'NotAttended') {
      html += `<div class="c-alert c-alert--info" role="status">
        <svg class="c-icon c-alert__icon"><use href="./kit/icons.svg#icon-info"></use></svg>
        <div class="c-alert__body"><p>You can review this movie after attending one of its sessions.</p></div>
      </div>`;
    } else if (checkData.status === 'Allowed') {
      html += `<div class="c-alert c-alert--info"><p>Review form coming soon.</p></div>`;
    } else if (checkData.status === 'AlreadyReviewed' && checkData.myReview) {
      const r = checkData.myReview;
      html += `
        <article class="c-review c-review--mine">
          <header class="c-review__header">
            <span class="c-badge c-badge--accent">Your review</span>
            <div class="c-stars c-stars--sm" style="--rating: ${r.rating}"><span class="c-stars__icons"></span><span class="c-stars__value">${r.rating}</span></div>
            <time class="c-review__date">${dateOnly(r.createdAt)}</time>
            <div class="c-review__actions">
              <button class="c-btn c-btn--ghost c-btn--sm" type="button"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-edit"></use></svg>Edit</button>
              <button class="c-btn c-btn--ghost c-btn--danger c-btn--sm" type="button"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-trash"></use></svg>Delete</button>
            </div>
          </header>
          <p class="c-review__text">${r.text}</p>
        </article>
      `;
    }
  }

  html += `<div id="reviews-list">`;
  if (data.items && data.items.length > 0) {
    data.items.filter(r => !r.isMine).forEach(r => {
      html += `
        <article class="c-review">
          <header class="c-review__header">
            <span class="c-review__author">${r.authorName}</span>
            <div class="c-stars c-stars--sm" style="--rating: ${r.rating}"><span class="c-stars__icons"></span><span class="c-stars__value">${r.rating}</span></div>
            <time class="c-review__date">${dateOnly(r.createdAt)}</time>
          </header>
          <p class="c-review__text">${r.text}</p>
        </article>
      `;
    });
  } else {
    html += `<div class="c-empty"><div class="c-empty__icon"><svg class="c-icon c-icon--lg"><use href="./kit/icons.svg#icon-star"></use></svg></div><h2 class="c-empty__title">There are no reviews yet.</h2></div>`;
  }
  html += `</div>`;
  sec.innerHTML = html;
}

init();