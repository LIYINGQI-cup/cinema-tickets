import { api } from '../api.js';
import { getConfig } from '../config.js';
import { renderHeader, toast, setLoading, emptyEl } from '../ui.js';
import { requireAuth } from '../auth-guard.js';
import { money, dateOnly, timeOnly, formatLabel, ageLabel, ticketsCount } from '../format.js';

requireAuth();
renderHeader('cart');
const main = document.getElementById('main-content');

let cartData = null;
let profileData = null;
let globalConfig = null;
let appliedPromo = null;
let selectedPayment = 'Card';

async function init() {
  main.innerHTML = `<div class="l-container" style="text-align:center; padding:50px;"><span class="c-spinner"></span></div>`;
  try {
    globalConfig = await getConfig();
    const [cart, profile] = await Promise.all([
      api.cart(),
      api.profile()
    ]);

    if (!cart.items || cart.items.length === 0) {
      location.replace('cart.html');
      return;
    }

    cartData = cart;
    profileData = profile;
    
    renderLayout();
  } catch (e) {
    main.innerHTML = `<div class="l-container">${emptyEl({ title: 'Error', text: e.message, error: true }).outerHTML}</div>`;
  }
}

function renderLayout() {
  const cutoffMs = (globalConfig.bookingCutoffMinutes || 0) * 60000;
  const now = Date.now();
  
  const groups = {};
  cartData.items.forEach(item => {
    const s = item.session;
    if (!groups[s.id]) {
      const isClosed = now + cutoffMs > new Date(s.startsAt).getTime();
      groups[s.id] = { session: s, items: [], subtotal: 0, isClosed };
    }
    groups[s.id].items.push(item);
    groups[s.id].subtotal += item.price;
  });

  const closedGroups = Object.values(groups).filter(g => g.isClosed);
  const hasClosedSessions = closedGroups.length > 0;

  const subtotal = appliedPromo ? appliedPromo.subtotal : cartData.totalPrice;
  const discount = appliedPromo ? appliedPromo.discountAmount : 0;
  const total = appliedPromo ? appliedPromo.total : cartData.totalPrice;

  main.innerHTML = `
    <div class="l-container l-stack l-stack--lg">
      <div class="c-page-title">
        <div class="c-page-title__main">
          <h1>Checkout</h1>
        </div>
      </div>

      ${hasClosedSessions ? `
        <div class="c-alert c-alert--danger" role="alert">
          <svg class="c-icon c-alert__icon" aria-hidden="true"><use href="./kit/icons.svg#icon-error"></use></svg>
          <div class="c-alert__body">
            <p>Booking is closed for ${closedGroups.length} session(s). Remove its seats from the cart to continue.</p>
          </div>
          <div class="c-alert__action">
            <a class="c-btn c-btn--secondary c-btn--sm" href="cart.html">Go to cart</a>
          </div>
        </div>
      ` : ''}

      <div class="l-split">
        <div class="l-split__main l-stack l-stack--md">
          
          <section class="c-card">
            <div class="c-card__header"><h2 class="c-card__title">Contact details</h2></div>
            <div class="c-card__body">
              <div class="c-static"><span class="c-static__label">Full name</span><span class="c-static__value">${profileData.fullName || '—'}</span></div>
              <div class="c-static"><span class="c-static__label">Email</span><span class="c-static__value">${profileData.email || '—'}</span></div>
              <div class="c-static"><span class="c-static__label">Phone number</span><span class="c-static__value">${profileData.phoneNumber || '—'}</span></div>
              <div class="c-static__action"><a href="profile.html" class="c-btn c-btn--secondary c-btn--sm">Edit the profile</a></div>
            </div>
          </section>

          <section class="c-card">
            <div class="c-card__header"><h2 class="c-card__title">Payment method</h2></div>
            <div class="c-card__body">
              <div class="c-radio-group">
                <label class="c-radio-card">
                  <input class="c-radio-card__input" type="radio" name="payment" value="Card" ${selectedPayment === 'Card' ? 'checked' : ''}>
                  <span class="c-radio-card__box">
                    <span class="c-radio-card__title">Card</span>
                  </span>
                </label>
                <label class="c-radio-card">
                  <input class="c-radio-card__input" type="radio" name="payment" value="Cash" ${selectedPayment === 'Cash' ? 'checked' : ''}>
                  <span class="c-radio-card__box">
                    <span class="c-radio-card__title">Cash</span>
                  </span>
                </label>
              </div>
            </div>
          </section>

          <section class="c-card">
            <div class="c-card__header"><h2 class="c-card__title">Promo code</h2></div>
            <div class="c-card__body">
              <div class="c-promo ${appliedPromo ? 'is-success' : ''}">
                ${appliedPromo 
                  ? `<div class="c-promo__applied"><span>${appliedPromo.code} - ${appliedPromo.description || 'Discount applied'}</span><button class="c-btn c-btn--ghost c-btn--sm" type="button" id="remove-promo-btn">Remove</button></div>`
                  : `<div class="c-promo__row">
                      <input class="c-input" id="promo-input" type="text" placeholder="Enter the promo code">
                      <button class="c-btn c-btn--secondary" type="button" id="apply-promo-btn">Apply</button>
                    </div>
                    <p class="c-field__error" id="promo-error" hidden><span></span></p>`
                }
              </div>
            </div>
          </section>

          <section class="l-stack l-stack--md">
            <h2 class="c-section-title">Tickets</h2>
            ${Object.values(groups).map(g => {
              const s = g.session;
              return `
                <article class="c-cart-group ${g.isClosed ? 'is-error' : ''}">
                  <header class="c-cart-group__header">
                    <div class="c-poster c-poster--xs"><img class="c-poster__img" src="${s.posterUrl}" alt=""></div>
                    <div class="c-cart-group__info">
                      <h3 class="c-cart-group__title">${s.movieTitle}</h3>
                      <p class="c-cart-group__meta">
                        <span>${dateOnly(s.startsAt)} · ${timeOnly(s.startsAt)}</span>
                        <span class="c-format">${formatLabel(s.format)}</span>
                        <span>${s.hallName}</span>
                        <span class="c-age">${ageLabel(s.ageRating)}</span>
                      </p>
                    </div>
                  </header>
                  ${g.isClosed ? `<p class="c-cart-group__error">Booking closed at ${timeOnly(new Date(new Date(s.startsAt).getTime() - cutoffMs))}</p>` : ''}
                  <ul class="c-cart-group__seats">
                    ${g.items.map(item => `
                      <li class="c-cart-seat">
                        <span class="c-cart-seat__label">Row ${item.row}, Seat ${item.number}</span>
                        <span class="c-badge c-badge--neutral">${item.seatType === 'Vip' ? 'VIP' : 'Standard'}</span>
                        <span class="c-cart-seat__price">${money(item.price)}</span>
                      </li>
                    `).join('')}
                  </ul>
                  <footer class="c-cart-group__footer"><span>Subtotal</span><span>${money(g.subtotal)}</span></footer>
                </article>
              `;
            }).join('')}
          </section>

        </div>

        <aside class="l-split__aside">
          <section class="c-summary">
            <h2 class="c-summary__title">Summary</h2>
            <dl class="c-summary__lines">
              <div class="c-summary__line"><dt>Subtotal</dt><dd>${money(subtotal)}</dd></div>
              ${appliedPromo ? `<div class="c-summary__line u-text-success"><dt>Discount (${appliedPromo.discountPercent}%)</dt><dd>−${money(discount)}</dd></div>` : ''}
              <div class="c-summary__total"><dt>Total</dt><dd>${money(total)}</dd></div>
            </dl>
            <div class="c-summary__actions">
              <button class="c-btn c-btn--primary c-btn--block" type="button" id="submit-order-btn" ${hasClosedSessions ? 'disabled' : ''}>Confirm booking</button>
            </div>
            <p class="c-summary__note">Booking closes ${globalConfig.bookingCutoffMinutes} minutes before the session start.</p>
          </section>
        </aside>
      </div>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll('input[name="payment"]').forEach(radio => {
    radio.addEventListener('change', (e) => { selectedPayment = e.target.value; });
  });

  const applyBtn = document.getElementById('apply-promo-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', async () => {
      const input = document.getElementById('promo-input');
      const code = input.value.trim();
      const errorEl = document.getElementById('promo-error');
      
      if (!code) {
        errorEl.querySelector('span').textContent = 'The promo code must be 1 to 32 characters long.';
        errorEl.hidden = false;
        return;
      }

      setLoading(applyBtn, true);
      errorEl.hidden = true;

      try {
        const res = await api.checkPromo(code);
        appliedPromo = res;
        renderLayout();
        toast('Promo code applied', 'success');
      } catch (e) {
        setLoading(applyBtn, false);
        errorEl.querySelector('span').textContent = e.message || 'Invalid promo code.';
        errorEl.hidden = false;
      }
    });
  }

  const removeBtn = document.getElementById('remove-promo-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      appliedPromo = null;
      renderLayout();
    });
  }

  const submitBtn = document.getElementById('submit-order-btn');
  if (submitBtn && !submitBtn.disabled) {
    submitBtn.addEventListener('click', async () => {
      setLoading(submitBtn, true);
      try {
        const payload = {
          cartItemIds: cartData.items.map(item => item.id),
          paymentMethod: selectedPayment,
          promoCode: appliedPromo ? appliedPromo.code : null
        };
        const res = await api.createBookings(payload);
        const count = Array.isArray(res) ? res.length : (res.bookings?.length || 1);
        location.replace(`bookings.html?created=${count}`);
      } catch (e) {
        setLoading(submitBtn, false);
        toast(e.message || 'Failed to create booking', 'danger');
      }
    });
  }
}

init();