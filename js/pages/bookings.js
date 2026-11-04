import { api } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, toast, emptyEl, updateCartCounter } from '../ui.js';
import { requireAuth } from '../auth-guard.js';
import { money, dateOnly, timeOnly, formatLabel, ticketsCount } from '../format.js';

requireAuth();
renderHeader('bookings');
const main = document.getElementById('main-content');

const params = new URLSearchParams(location.search);
const createdCount = params.get('created');

let globalConfig = null;
let cartData = null;
let currentBookingIdToCancel = null;

async function init() {
  main.innerHTML = `<div class="l-container" style="text-align:center; padding:50px;"><span class="c-spinner"></span></div>`;
  
  try {
    globalConfig = await getConfig();
    const [bookings, cart] = await Promise.all([
      api.bookings(),
      api.cart()
    ]);
    
    cartData = cart;
    renderPage(bookings);
  } catch (e) {
    main.innerHTML = `<div class="l-container">${emptyEl({ title: 'Error', text: e.message, error: true }).outerHTML}</div>`;
  }
}

function renderPage(bookings) {
  if (!bookings || bookings.length === 0) {
    main.innerHTML = `<div class="l-container l-stack l-stack--lg">${emptyEl({
      title: 'There are no bookings yet',
      text: 'Your future movie tickets will appear here.',
      action: '<a class="c-btn c-btn--primary" href="index.html">Browse movies</a>',
      icon: 'icon-ticket'
    }).outerHTML}</div>`;
    return;
  }

  const cutoffMs = (globalConfig.cancellationCutoffMinutes || 0) * 60000;
  const now = Date.now();

  let alertsHtml = '';
  if (createdCount) {
    alertsHtml = `
      <div class="c-alert c-alert--success" role="status">
        <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="./kit/icons.svg#icon-check"></use></svg>
        <div class="c-alert__body">
          <p>${createdCount === '1' ? '1 booking is created. The cart is empty.' : `${createdCount} bookings are created. The cart is empty.`}</p>
        </div>
      </div>
    `;
  }

  let cartAlertHtml = '';
  if (cartData && cartData.ticketsCount > 0) {
    cartAlertHtml = `
      <section class="c-card c-card--highlight">
        <div class="c-card__body c-card__body--row">
          <p>The cart contains ${ticketsCount(cartData.ticketsCount)}.</p>
          <a class="c-btn c-btn--primary" href="purchase.html">Proceed to checkout</a>
        </div>
      </section>
    `;
  }

  const bookingsHtml = bookings.map(b => {
    const s = b.session;
    const isActive = b.status === 'Active';
    const startMs = new Date(s.startsAt).getTime();
    const cancelCutoffTime = new Date(startMs - cutoffMs);
    
    const isCancelable = isActive && now < cancelCutoffTime.getTime();

    let actionHtml = '';
    if (isActive) {
      if (isCancelable) {
        actionHtml = `<button class="c-btn c-btn--secondary c-btn--sm js-cancel-btn" data-id="${b.id}" data-code="${b.code}">Cancel booking</button>`;
      } else {
        actionHtml = `<span class="c-text-muted">Cancellation closed at ${timeOnly(cancelCutoffTime)}</span>`;
      }
    } else if (b.status === 'Completed') {
      actionHtml = `<a class="c-btn c-btn--secondary c-btn--sm" href="movie.html?id=${b.movie.id}">Review the movie</a>`;
    }

    const statusClass = b.status.toLowerCase();
    const statusBadge = `<span class="c-status c-status--${statusClass}">${b.status}</span>`;

    return `
      <article class="c-card c-booking-row">
        <div class="c-booking-row__main">
          <div class="c-poster c-poster--xs"><img class="c-poster__img" src="${b.movie.posterUrl}" alt=""></div>
          <div class="c-booking-row__info">
            <h3 class="c-booking-row__title">
              <a href="booking.html?id=${b.id}">${b.movie.title}</a>
            </h3>
            <p class="c-booking-row__meta">
              <span>${dateOnly(s.startsAt)} · ${timeOnly(s.startsAt)}</span>
              <span class="c-format">${formatLabel(s.format)}</span>
              <span>${s.hallName}</span>
            </p>
            <div class="c-booking-row__code">${b.code}</div>
          </div>
        </div>
        
        <div class="c-booking-row__stats">
          <span>${ticketsCount(b.ticketsCount)}</span>
          <span>${money(b.total)}</span>
          ${statusBadge}
        </div>

        <div class="c-booking-row__action">
          ${actionHtml}
        </div>
      </article>
    `;
  }).join('');

  main.innerHTML = `
    <div class="l-container l-stack l-stack--lg">
      <div class="c-page-title">
        <div class="c-page-title__main">
          <h1>Bookings</h1>
        </div>
      </div>

      ${alertsHtml}
      ${cartAlertHtml}

      <div class="l-stack l-stack--sm">
        ${bookingsHtml}
      </div>
    </div>
  `;

  bindEvents();
  updateCartCounter();
}

function bindEvents() {
  const dialog = document.getElementById('cancel-dialog');
  const confirmBtn = document.getElementById('confirm-cancel-btn');

  document.querySelectorAll('.js-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentBookingIdToCancel = btn.dataset.id;
      dialog.showModal();
    });
  });

  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'confirm' && currentBookingIdToCancel) {
      confirmBtn.classList.add('is-loading');
      confirmBtn.disabled = true;

      try {
        await api.cancelBooking(currentBookingIdToCancel);
        toast('The booking is cancelled.', 'success');
        init();
      } catch (e) {
        toast(e.message || 'Failed to cancel booking', 'danger');
      } finally {
        confirmBtn.classList.remove('is-loading');
        confirmBtn.disabled = false;
        currentBookingIdToCancel = null;
      }
    }
  });
}

init();