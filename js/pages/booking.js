import { api } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, toast, emptyEl } from '../ui.js';
import { requireAuth } from '../auth-guard.js';
import { money, dateOnly, timeOnly, formatLabel, ageLabel, ticketsCount } from '../format.js';

requireAuth();
renderHeader('bookings');
const main = document.getElementById('main-content');

const params = new URLSearchParams(location.search);
const bookingId = params.get('id');

let globalConfig = null;
let bookingData = null;

async function init() {
  if (!bookingId) {
    main.innerHTML = `<div class="l-container">${emptyEl({ title: 'Booking was not found', text: 'The booking does not exist.', error: true, action: '<a class="c-btn c-btn--secondary" href="bookings.html">All bookings</a>' }).outerHTML}</div>`;
    return;
  }

  main.innerHTML = `<div class="l-container" style="text-align:center; padding:50px;"><span class="c-spinner"></span></div>`;
  
  try {
    globalConfig = await getConfig();
    bookingData = await api.booking(bookingId);
    renderPage();
  } catch (e) {
    main.innerHTML = `<div class="l-container">${emptyEl({ 
      title: 'The booking was not found', 
      text: 'The booking does not exist or belongs to another account.', 
      error: true, 
      action: '<a class="c-btn c-btn--secondary" href="bookings.html">All bookings</a>' 
    }).outerHTML}</div>`;
  }
}

function renderPage() {
  const b = bookingData;
  const s = b.session;
  const isCancelled = b.status === 'Cancelled';
  const isCompleted = b.status === 'Completed';
  const isActive = b.status === 'Active';
  
  const cutoffMs = (globalConfig.cancellationCutoffMinutes || 0) * 60000;
  const now = Date.now();
  const startMs = new Date(s.startsAt).getTime();
  const cancelCutoffTime = new Date(startMs - cutoffMs);
  const isCancelable = isActive && now < cancelCutoffTime.getTime();

  const statusClass = b.status.toLowerCase();

  main.innerHTML = `
    <div class="l-container l-stack l-stack--lg">
      <a class="c-back-link" href="bookings.html"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-left"></use></svg>All bookings</a>
      
      <div class="c-page-title c-page-title--row">
        <div class="c-page-title__main">
          <h1>Booking ${b.code} <span class="c-status c-status--${statusClass}">${b.status}</span></h1>
        </div>
        ${isCancelable ? `<button class="c-btn c-btn--secondary js-cancel-btn" type="button">Cancel booking</button>` : ''}
      </div>

      ${isCompleted ? `
        <div class="c-alert c-alert--info" role="status">
          <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="./kit/icons.svg#icon-info"></use></svg>
          <div class="c-alert__body"><p>The session has taken place. You can review the movie.</p></div>
          <div class="c-alert__action">
            <a class="c-btn c-btn--secondary c-btn--sm" href="movie.html?id=${b.movie.id}">Review the movie</a>
          </div>
        </div>
      ` : ''}

      <section class="c-card">
        <div class="c-card__body c-media">
          <div class="c-poster c-poster--sm"><img class="c-poster__img" src="${b.movie.posterUrl}" alt=""></div>
          <div class="c-media__content">
            <h2 class="c-media__title"><a href="movie.html?id=${b.movie.id}">${b.movie.title}</a></h2>
            <p class="c-media__meta">
              <span>${dateOnly(s.startsAt)} · ${timeOnly(s.startsAt)}-${timeOnly(s.endsAt)}</span>
              <span class="c-format">${formatLabel(s.format)}</span>
              <span>${s.hallName}</span>
              <span class="c-age">${ageLabel(b.movie.ageRating)}</span>
            </p>
          </div>
        </div>
      </section>

      <div class="l-split l-split--even">
        <section class="c-card">
          <div class="c-card__header"><h2 class="c-card__title">Details</h2></div>
          <div class="c-card__body">
            <dl class="c-dl">
              <div class="c-dl__row"><dt>Booking code</dt><dd>${b.code}</dd></div>
              <div class="c-dl__row"><dt>Created</dt><dd>${dateOnly(b.createdAt)} ${timeOnly(b.createdAt)}</dd></div>
              ${isCancelled ? `<div class="c-dl__row"><dt>Cancelled</dt><dd>${dateOnly(b.cancelledAt)} ${timeOnly(b.cancelledAt)}</dd></div>` : ''}
              <div class="c-dl__row"><dt>Payment method</dt><dd>${b.paymentMethod}</dd></div>
              <div class="c-dl__row"><dt>Contact email</dt><dd>${b.contactEmail}</dd></div>
              <div class="c-dl__row"><dt>Contact phone</dt><dd>${b.contactPhone}</dd></div>
              <div class="c-dl__row"><dt>Promo code</dt><dd>${b.promoCode ? `${b.promoCode}, ${b.discountPercent}%` : '—'}</dd></div>
            </dl>
          </div>
        </section>

        <section class="c-card">
          <div class="c-card__header"><h2 class="c-card__title">Tickets <span class="u-text-muted">${ticketsCount(b.ticketsCount)}</span></h2></div>
          <div class="c-card__body">
            <table class="c-table">
              <thead>
                <tr><th>Row</th><th>Seat</th><th>Type</th><th class="u-text-right">Price</th></tr>
              </thead>
              <tbody>
                ${b.tickets.map(t => `
                  <tr>
                    <td>${t.row}</td>
                    <td>${t.number}</td>
                    <td>${t.seatType === 'Vip' ? 'VIP' : 'Standard'}</td>
                    <td class="u-text-right">${money(t.price)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <dl class="c-summary__lines u-mt-md">
              <div class="c-summary__line"><dt>Subtotal</dt><dd>${money(b.subtotal)}</dd></div>
              ${b.discountAmount ? `<div class="c-summary__line u-text-success"><dt>Discount (${b.discountPercent}%)</dt><dd>−${money(b.discountAmount)}</dd></div>` : ''}
              <div class="c-summary__total"><dt>Total</dt><dd>${money(b.total)}</dd></div>
            </dl>
          </div>
        </section>
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  const dialog = document.getElementById('cancel-dialog');
  const confirmBtn = document.getElementById('confirm-cancel-btn');
  const cancelBtns = document.querySelectorAll('.js-cancel-btn');

  cancelBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dialog.showModal();
    });
  });

  dialog.addEventListener('close', async () => {
    if (dialog.returnValue === 'confirm') {
      confirmBtn.classList.add('is-loading');
      confirmBtn.disabled = true;

      try {
        await api.cancelBooking(bookingId);
        toast('The booking is cancelled.', 'success');
        bookingData = await api.booking(bookingId);
        renderPage();
      } catch (e) {
        toast(e.message || 'Failed to cancel booking', 'danger');
      } finally {
        confirmBtn.classList.remove('is-loading');
        confirmBtn.disabled = false;
      }
    }
  });
}

init();