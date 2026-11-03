import { api } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, toast, emptyEl, updateCartCounter, isAuthorized } from '../ui.js';
import { money, ticketsCount, timerText, formatLabel, sessionDateTime } from '../format.js';

if (!isAuthorized()) {
  location.replace('login.html?returnUrl=' + encodeURIComponent(location.pathname));
}

renderHeader('cart');
const main = document.getElementById('main-content');
let globalConfig = null;
let timerInterval = null;

async function init() {
  try {
    globalConfig = await getConfig();
    const cartData = await api.cart();
    renderCart(cartData);
    startTimer(cartData);
  } catch (e) {
    toast('Failed to load cart', 'danger');
    main.innerHTML = '';
  }
}

function groupItemsBySession(items) {
  const groups = {};
  items.forEach(item => {
    const sid = item.session.id;
    if (!groups[sid]) {
      groups[sid] = {
        session: item.session,
        items: [],
        subtotal: 0
      };
    }
    groups[sid].items.push(item);
    groups[sid].subtotal += item.price;
  });
  return Object.values(groups);
}

function renderCart(cartData) {
  const items = cartData.items || [];
  
  if (items.length === 0) {
    main.innerHTML = `<div class="l-container l-stack l-stack--lg">${emptyEl({
      title: 'The cart is empty',
      text: 'Find a movie and pick your seats.',
      action: '<a class="c-btn c-btn--primary" href="index.html">Browse movies</a>',
      icon: 'icon-ticket'
    }).outerHTML}</div>`;
    updateCartCounter();
    return;
  }

  const groups = groupItemsBySession(items);
  const maxSeats = globalConfig?.maxSeatsPerSession || 8;

  let groupsHtml = groups.map(g => {
    const showTime = sessionDateTime(g.session.startAt);
    const format = formatLabel(g.session.format);
    
    const seatsHtml = g.items.map(item => `
      <li class="c-cart-item">
        <div class="c-cart-item__info">
          <span class="c-cart-item__title">Row ${item.row}, Seat ${item.number}</span>
          <span class="c-badge c-badge--neutral">${item.seatType === 'Vip' ? 'VIP' : 'Standard'}</span>
        </div>
        <div class="c-cart-item__price">${money(item.price)}</div>
        <button class="c-btn c-btn--ghost c-btn--icon c-btn--sm js-remove-btn" type="button" data-id="${item.id}" aria-label="Remove ticket">
          <svg class="c-icon c-icon--sm" aria-hidden="true"><use href="./kit/icons.svg#icon-trash"></use></svg>
        </button>
      </li>
    `).join('');

    return `
      <section class="c-card">
        <div class="c-card__header">
          <div>
            <h2 class="c-card__title">${g.session.movieTitle}</h2>
            <p class="c-card__subtitle">${showTime} · ${format} · ${g.session.hallName}</p>
          </div>
        </div>
        <div class="c-card__body">
          <ul class="c-cart-list">${seatsHtml}</ul>
        </div>
        <div class="c-card__footer">
          <div class="c-summary__line"><dt>Subtotal</dt><dd>${money(g.subtotal)}</dd></div>
        </div>
      </section>
    `;
  }).join('');

  main.innerHTML = `
    <div class="l-container l-stack l-stack--lg">
      <div class="c-page-title">
        <div class="c-page-title__main">
          <h1>Your Cart</h1>
          <div class="c-page-title__subtitle">${ticketsCount(cartData.ticketsCount)} selected</div>
        </div>
      </div>

      <div class="l-split l-split--wide-main">
        <div class="l-split__main l-stack l-stack--md">
          ${groupsHtml}
        </div>

        <aside class="l-split__aside">
          <section class="c-summary">
            <h2 class="c-summary__title">Summary</h2>
            <dl class="c-summary__lines">
              <div class="c-summary__line"><dt>Tickets</dt><dd>${ticketsCount(cartData.ticketsCount)}</dd></div>
              <div class="c-summary__total"><dt>Total</dt><dd>${money(cartData.totalPrice)}</dd></div>
            </dl>
            ${cartData.holdExpiresAt ? `
              <p class="c-timer" id="cart-timer">
                <svg class="c-icon c-icon--sm"><use href="./kit/icons.svg#icon-clock"></use></svg>
                <span>Holds expire in ...</span>
              </p>
            ` : ''}
            <div class="c-summary__actions">
              <a class="c-btn c-btn--primary c-btn--block" href="purchase.html">Proceed to checkout</a>
            </div>
            <p class="c-summary__note">Up to ${maxSeats} seats per session.</p>
          </section>
        </aside>
      </div>
    </div>
  `;

  bindEvents();
  updateCartCounter(cartData.ticketsCount);
  if (cartData.holdExpiresAt) {
    updateTimerDisplay(new Date(cartData.holdExpiresAt).getTime() - Date.now());
  }
}

function bindEvents() {
  main.querySelectorAll('.js-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      btn.classList.add('is-loading');
      try {
        await api.removeCartItem(id);
        const newCart = await api.cart();
        renderCart(newCart);
        startTimer(newCart);
        toast('Seat removed', 'success');
      } catch (e) {
        toast(e.message || 'Failed to remove seat', 'danger');
      } finally {
        btn.classList.remove('is-loading');
      }
    });
  });
}

function startTimer(cartData) {
  if (timerInterval) clearInterval(timerInterval);
  if (!cartData.holdExpiresAt) return;

  const expiresMs = new Date(cartData.holdExpiresAt).getTime();

  timerInterval = setInterval(() => {
    const left = expiresMs - Date.now();
    const timerEl = document.getElementById('cart-timer');
    
    if (left <= 0) {
      clearInterval(timerInterval);
      api.cart().then(newCart => {
        renderCart(newCart);
        startTimer(newCart);
      }).catch(() => {});
    } else if (timerEl) {
      updateTimerDisplay(left);
      if (left < 120000) {
        timerEl.classList.add('is-warning');
      }
    }
  }, 1000);
}

function updateTimerDisplay(leftMs) {
  const timerEl = document.getElementById('cart-timer');
  if (timerEl) {
    timerEl.querySelector('span').textContent = `Holds expire in ${timerText(leftMs)}`;
  }
}

init();