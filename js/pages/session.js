import { api } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, toast, updateCartCounter, isAuthorized } from '../ui.js';
import { dateOnly, timeRange, formatLabel, ageLabel, money, timerText } from '../format.js';

renderHeader('movies');

const params = new URLSearchParams(location.search);
const sessionId = params.get('id');
const main = document.getElementById('main-content');

let currentSession = null;
let seatsData = null;
let cartData = null;
let timerInterval = null;
let globalConfig = null;

async function init() {
  if (!sessionId) return renderError('Session not found');
  
  try {
    globalConfig = await getConfig();
    const promises = [api.session(sessionId), api.seats(sessionId)];
    if (isAuthorized()) promises.push(api.cart());
    
    const [session, seats, cart] = await Promise.all(promises);
    
    currentSession = session;
    seatsData = seats;
    cartData = cart;

    renderLayout(globalConfig);
    renderSeatmap();
    renderSummary();
    startTimer();

  } catch (e) {
    renderError(e.message || 'Error loading session');
  }
}

function renderError(msg) {
  main.innerHTML = `<div class="l-container"><div class="c-empty c-empty--error"><h2 class="c-empty__title">${msg}</h2><a href="index.html" class="c-btn c-btn--secondary">Back to catalog</a></div></div>`;
}

function renderLayout(config) {
  const isClosed = !currentSession.isBookingOpen;
  
  let closeTime = 'Unknown';
  if (currentSession.bookingClosesAt) {
    closeTime = new Date(currentSession.bookingClosesAt).toLocaleTimeString('en-GB', { 
      hour: '2-digit', minute: '2-digit', timeZone: config.timeZone 
    });
  }

  const timeStr = currentSession.startsAt === currentSession.endAt 
    ? dateOnly(currentSession.startsAt)
    : `${dateOnly(currentSession.startsAt)} · ${timeRange(currentSession.startsAt, currentSession.endAt)}`;

  main.innerHTML = `
    <div class="l-container l-stack l-stack--lg">
      <a class="c-back-link" href="movie.html?id=${currentSession.movie.id}"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-chevron-left"></use></svg>Back to the movie</a>
      
      <div class="c-page-title">
        <div class="c-page-title__main">
          <h1>${currentSession.movie.title}</h1>
          <div class="c-page-title__subtitle">
            <span class="c-page-title__item"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-calendar"></use></svg>${timeStr}</span>
            <span class="c-format">${formatLabel(currentSession.format)}</span>
            <span class="c-page-title__item"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-hall"></use></svg>${currentSession.hall.name}</span>
            <span class="c-age">${ageLabel(currentSession.movie.ageRating)}</span>
          </div>
        </div>
      </div>

      <div class="l-split">
        <div class="l-split__main">
          ${isClosed ? `<div class="c-alert c-alert--warning" role="alert"><svg class="c-icon c-alert__icon"><use href="./kit/icons.svg#icon-warning"></use></svg><div class="c-alert__body"><p>Booking for this session closed at ${closeTime}.</p></div></div>` : ''}
          ${!isAuthorized() ? `<div class="c-alert c-alert--info" role="status"><svg class="c-icon c-alert__icon"><use href="./kit/icons.svg#icon-info"></use></svg><div class="c-alert__body"><p>Log in to select seats.</p></div><div class="c-alert__action"><a class="c-btn c-btn--secondary c-btn--sm" href="login.html?returnUrl=${encodeURIComponent(location.pathname + location.search)}">Log in</a></div></div>` : ''}
          
          <section class="c-card" id="seatmap-container"></section>
        </div>
        
        <aside class="l-split__aside" id="summary-container"></aside>
      </div>
    </div>
  `;
}

function renderSeatmap() {
  const container = document.getElementById('seatmap-container');
  const { rowsCount, seatsPerRow, seats } = seatsData;
  const isClosed = !currentSession.isBookingOpen;

  let html = `<div class="c-card__body"><div class="c-seatmap" style="--seat-cols: ${seatsPerRow}">
    <div class="c-seatmap__screen" aria-hidden="true">Screen</div>
    <div class="c-seatmap__rows">
  `;

  for (let r = 1; r <= rowsCount; r++) {
    html += `<div class="c-seatmap__row">
      <span class="c-seatmap__label" aria-hidden="true">${r}</span>
    `;
    
    for (let s = 1; s <= seatsPerRow; s++) {
      const seat = seats.find(x => x.row === r && x.number === s);
      if (!seat) continue;

      let classes = 'c-seat';
      if (seat.type === 'Vip') classes += ' c-seat--vip';
      
      let attrs = `data-row="${r}" data-number="${s}" data-id="${seat.cartItemId || ''}" aria-label="Row ${r}, Seat ${s}, ${seat.type === 'Vip' ? 'VIP' : 'Standard'}, ${money(seat.price)}"`;
      
      if (seat.status === 'InMyCart') {
        attrs += ` aria-pressed="true"`;
      } else if (seat.status === 'Occupied') {
        attrs += ` disabled`;
      } else {
        attrs += ` aria-pressed="false"`;
        if (isClosed || !isAuthorized()) attrs += ` disabled`;
      }

      html += `<button class="${classes}" type="button" ${attrs}></button>`;
    }
    
    html += `<span class="c-seatmap__label" aria-hidden="true">${r}</span></div>`;
  }

  html += `</div></div>
    <ul class="c-legend" aria-label="Legend">
      <li class="c-legend__item"><span class="c-seat c-legend__seat" aria-hidden="true"></span>Standard · ${money(currentSession.prices.standard)}</li>
      <li class="c-legend__item"><span class="c-seat c-seat--vip c-legend__seat" aria-hidden="true"></span>VIP · ${money(currentSession.prices.vip)}</li>
      <li class="c-legend__item"><span class="c-seat c-legend__seat c-legend__seat--occupied" aria-hidden="true"></span>Occupied</li>
      <li class="c-legend__item"><span class="c-seat c-legend__seat c-legend__seat--mine" aria-hidden="true"></span>In your cart</li>
    </ul>
  </div>`;

  container.innerHTML = html;

  container.querySelectorAll('button.c-seat').forEach(btn => {
    btn.addEventListener('click', () => handleSeatClick(btn));
  });
}

async function handleSeatClick(btn) {
  if (!isAuthorized() || !currentSession.isBookingOpen) return;
  
  const row = Number(btn.dataset.row);
  const number = Number(btn.dataset.number);
  const cartItemId = btn.dataset.id;
  const isPressed = btn.getAttribute('aria-pressed') === 'true';

  btn.classList.add('is-loading');
  
  try {
    if (isPressed && cartItemId) {
      await api.removeCartItem(cartItemId);
      btn.setAttribute('aria-pressed', 'false');
      btn.dataset.id = '';
    } else {
      const res = await api.addToCart({ sessionId, row, number });
      btn.setAttribute('aria-pressed', 'true');
      btn.dataset.id = res.id; 
      seatsData = await api.seats(sessionId);
      renderSeatmap();
    }
    
    cartData = await api.cart();
    renderSummary();
    updateCartCounter();

  } catch (e) {
    if (['SEAT_OCCUPIED', 'ALREADY_IN_CART'].includes(e.code)) {
      toast(e.message, 'danger');
      seatsData = await api.seats(sessionId);
      renderSeatmap();
    } else {
      toast(e.message, 'danger');
    }
  } finally {
    btn.classList.remove('is-loading');
  }
}

function getMySessionItems() {
  if (!cartData || !cartData.items) return [];
  
  return cartData.items.filter(item => {
    return item.session && String(item.session.id) === String(sessionId);
  });
}

function renderSummary() {
  const aside = document.getElementById('summary-container');
  const isClosed = !currentSession.isBookingOpen;
  
  const maxSeats = globalConfig?.maxSeatsPerSession || 8;
  
  if (isClosed || !isAuthorized()) {
    aside.innerHTML = `
      <section class="c-summary">
        <h2 class="c-summary__title">Prices</h2>
        <dl class="c-summary__lines">
          <div class="c-summary__line"><dt>Standard</dt><dd>${money(currentSession.prices.standard)}</dd></div>
          <div class="c-summary__line"><dt>VIP</dt><dd>${money(currentSession.prices.vip)}</dd></div>
        </dl>
        <p class="c-summary__note">Up to ${maxSeats} seats per session.</p>
        ${!isClosed ? `<div class="c-summary__actions"><a class="c-btn c-btn--secondary c-btn--block" href="login.html">Log in</a></div>` : ''}
      </section>
    `;
    return;
  }

  const mySessionItems = getMySessionItems();

  let listHtml = mySessionItems.map(item => {
    const cId = item.id;
    return `
    <li class="c-cart-seat">
      <span class="c-cart-seat__label">Row ${item.row}, Seat ${item.number}</span>
      <span class="c-badge c-badge--neutral">${item.seatType === 'Vip' ? 'VIP' : 'Standard'}</span>
      <span class="c-cart-seat__price">${money(item.price)}</span>
      <button class="c-btn c-btn--ghost c-btn--icon c-btn--sm js-remove-seat" type="button" data-cart-item-id="${cId}" aria-label="Remove row ${item.row}, seat ${item.number}">
        <svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-trash"></use></svg>
      </button>
    </li>
  `}).join('');

  const total = mySessionItems.reduce((sum, i) => sum + i.price, 0);
  const earliestHold = mySessionItems.length ? new Date(Math.min(...mySessionItems.map(i => new Date(i.heldUntil).getTime()))) : null;
  const leftMs = earliestHold ? earliestHold - new Date() : 0;

  aside.innerHTML = `
    <section class="c-summary">
      <h2 class="c-summary__title">Your seats</h2>
      <ul class="c-summary__list">${listHtml || '<p class="u-muted">No seats selected</p>'}</ul>
      <dl class="c-summary__lines">
        <div class="c-summary__line"><dt>Tickets</dt><dd>${mySessionItems.length}</dd></div>
        <div class="c-summary__total"><dt>Total</dt><dd>${money(total)}</dd></div>
      </dl>
      ${earliestHold ? `<p class="c-timer" id="summary-timer"><svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-clock"></use></svg><span>Held until ${earliestHold.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})} · ${timerText(leftMs)} left</span></p>` : ''}
      <div class="c-summary__actions">
        <a class="c-btn c-btn--primary c-btn--block ${mySessionItems.length === 0 ? 'is-disabled' : ''}" href="cart.html" ${mySessionItems.length === 0 ? 'aria-disabled="true"' : ''}>Go to cart</a>
      </div>
      <p class="c-summary__note">Up to ${maxSeats} seats per session.</p>
    </section>
  `;

  aside.querySelectorAll('.js-remove-seat').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cid = btn.dataset.cartItemId;
      if (!cid) return;
      btn.classList.add('is-loading');
      try {
        await api.removeCartItem(cid);
        cartData = await api.cart();
        seatsData = await api.seats(sessionId);
        renderSeatmap();
        renderSummary();
        updateCartCounter();
      } catch (e) {
        toast(e.message, 'danger');
      } finally {
        btn.classList.remove('is-loading');
      }
    });
  });
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const timerEl = document.getElementById('summary-timer');
    if (!timerEl || !cartData) return;
    
    const myItems = getMySessionItems();
    if (!myItems.length) return;

    const earliestHold = new Date(Math.min(...myItems.map(i => new Date(i.heldUntil).getTime())));
    const leftMs = earliestHold - new Date();
    
    if (leftMs <= 0) {
      clearInterval(timerInterval);
      api.cart().then(c => { 
        cartData = c; 
        renderSummary(); 
        api.seats(sessionId).then(s => { seatsData = s; renderSeatmap(); });
        updateCartCounter(); 
      });
    } else {
      timerEl.querySelector('span').textContent = `Held until ${earliestHold.toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'})} · ${timerText(leftMs)} left`;
      if (leftMs < 120000) timerEl.classList.add('is-warning');
    }
  }, 1000);
}

init();