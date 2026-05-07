'use strict';

/**
 * Puppeteer-based booking automation for hotelgest.com.
 *
 * Flow (verified visually May 2026):
 *   1. Page loads with date-picker calendar AUTO-OPEN — must use it (hidden
 *      inputs dfrom/dto don't update MobiScroll's internal state correctly).
 *   2. Click start date by aria-label → click end date → click "Accept" button.
 *   3. Click .button-hg (Search) → rooms appear.
 *   4. Click .modalRate (room card) → rate modal opens.
 *   5. Click .addcart.btn-hg (Add) → checkout form becomes visible.
 *   6. Fill name, surname, email; phone is split into prefix-select + digits.
 *   7. Toggle #chck-lopd checkbox.
 *   8. Click #btn-AddBooking (Submit).
 *   9. Monei JS calls api.monei.com/v1/payment-methods?paymentId=XXX —
 *      we intercept this request to extract the payment ID.
 *  10. Hosted payment URL = https://secure.monei.com/payments/{paymentId}.
 */

const puppeteer = require('puppeteer');
const config    = require('./config');
const logger    = require('./utils/logger');

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    defaultViewport: { width: 1280, height: 900 }, // desktop layout
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

// "14-05-2026" → "Thursday, May 14, 2026"  (matches calendar cell aria-label)
function formatDateAriaLabel(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split('-').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

// Type into a text field reliably (focus → clear → type)
async function typeField(page, selector, value) {
  await page.waitForSelector(selector, { visible: true, timeout: config.booking.elementTimeout });
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, String(value));
}

// Phone field is split: <select prefix> + <input digits>.
// Find the longest matching prefix from the select's options.
async function setPhoneFields(page, fullPhone) {
  await page.waitForSelector('#booking-customer-prefix-phone', { timeout: config.booking.elementTimeout });
  await page.evaluate((phone) => {
    const sel = document.querySelector('#booking-customer-prefix-phone');
    const validPrefixes = Array.from(sel.options)
      .map(o => o.value)
      .filter(v => v && v.startsWith('+'))
      .sort((a, b) => b.length - a.length); // longest first
    const matched = validPrefixes.find(p => phone.startsWith(p));
    const prefix = matched || '+34';
    const number = phone.slice(prefix.length).replace(/\D/g, '');

    sel.value = prefix;
    sel.dispatchEvent(new Event('change', { bubbles: true }));

    const input = document.querySelector('#booking-customer-phone');
    input.value = number;
    input.dispatchEvent(new Event('input',  { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, fullPhone);
}

// Save a screenshot if DEBUG=1
async function debugShot(page, name) {
  if (!process.env.DEBUG) return;
  const path = `./debug-screenshots/${Date.now()}-${name}.png`;
  try {
    await page.screenshot({ path, fullPage: true });
    logger.debug('saved', path);
  } catch {}
}

/**
 * Complete a booking end-to-end.
 *
 * @param {object} opts
 * @param {string} opts.checkIn    DD-MM-YYYY
 * @param {string} opts.checkOut   DD-MM-YYYY
 * @param {object} opts.guest      { firstName, lastName, email, phone, address?, city?, zipCode?, country? }
 * @returns {{ success: boolean, paymentUrl?: string, error?: string }}
 */
async function bookRoom({ checkIn, checkOut, guest }) {
  const browser = await launchBrowser();
  const page    = await browser.newPage();

  // ── Capture Monei payment URL via intercepted request ────────────────────
  let resolvePayment, rejectPayment;
  const paymentPromise = new Promise((res, rej) => {
    resolvePayment = res;
    rejectPayment  = rej;
  });
  paymentPromise.catch(() => {}); // suppress unhandled-rejection crash

  page.on('request', (req) => {
    const m = req.url().match(/api\.monei\.com\/v1\/payment-methods\?paymentId=([a-f0-9]+)/);
    if (m) {
      const paymentUrl = `https://secure.monei.com/payments/${m[1]}`;
      logger.info('Captured Monei payment URL:', paymentUrl);
      resolvePayment(paymentUrl);
    }
  });

  const paymentTimeout = setTimeout(
    () => rejectPayment(new Error(`Payment URL not received within ${config.booking.paymentTimeout / 1000}s`)),
    config.booking.paymentTimeout,
  );

  try {
    // ── 1. Load page ──────────────────────────────────────
    logger.info('bookRoom: loading page...');
    await page.goto(config.booking.url, { waitUntil: 'domcontentloaded' });

    // ── 2. Calendar auto-opens — wait for date cell, then pick dates ──
    const startLabel = formatDateAriaLabel(checkIn);
    const endLabel   = formatDateAriaLabel(checkOut);
    logger.info('bookRoom: picking dates', startLabel, '→', endLabel);

    await page.waitForSelector(`[aria-label="${startLabel}"]`, {
      visible: true, timeout: config.booking.elementTimeout,
    });

    // Click via JS — clicking the inner div with aria-label may not bubble correctly
    await page.evaluate((label) => {
      document.querySelector(`[aria-label="${label}"]`)?.click();
    }, startLabel);
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate((label) => {
      document.querySelector(`[aria-label="${label}"]`)?.click();
    }, endLabel);
    await new Promise(r => setTimeout(r, 300));

    // ── 3. Click Accept (find button by text) ─────────────
    logger.info('bookRoom: clicking Accept...');
    await page.evaluate(() => {
      const accept = Array.from(document.querySelectorAll('button'))
        .find(b => b.innerText.trim() === 'Accept');
      accept?.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // ── 4. Click Search ───────────────────────────────────
    logger.info('bookRoom: clicking Search...');
    await page.waitForSelector('.button-hg', { visible: true, timeout: config.booking.elementTimeout });
    await page.click('.button-hg');
    // Wait for search results to load — old .modalRate is visible from default
    // dates so waitForSelector returns immediately; we need network to settle.
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 500));
    await page.waitForSelector('.modalRate', { visible: true, timeout: config.booking.elementTimeout });
    await debugShot(page, 'rooms');

    // ── 5. Click first available room ─────────────────────
    logger.info('bookRoom: opening room modal...');
    await page.click('.modalRate');
    // Rate modal opens with animation — wait for it to settle
    await new Promise(r => setTimeout(r, 800));
    await page.waitForSelector('.addcart.btn-hg', { visible: true, timeout: config.booking.elementTimeout });
    await debugShot(page, 'rate-modal');

    // ── 6. Click Add ──────────────────────────────────────
    logger.info('bookRoom: adding to cart...');
    await page.click('.addcart.btn-hg');
    await page.waitForSelector('#booking-customer-name', { visible: true, timeout: config.booking.elementTimeout });
    await debugShot(page, 'checkout-form');

    // ── 7. Fill guest form ────────────────────────────────
    logger.info('bookRoom: filling guest form...');
    await typeField(page, '#booking-customer-name',    guest.firstName);
    await typeField(page, '#booking-customer-surname', guest.lastName);
    await typeField(page, '#booking-customer-email',   guest.email);
    await setPhoneFields(page, guest.phone);

    if (guest.address) await typeField(page, '#booking-customer-address', guest.address);
    if (guest.city)    await typeField(page, '#booking-customer-city',    guest.city);
    if (guest.zipCode) await typeField(page, '#customer-zipcode',         guest.zipCode);
    if (guest.country) await typeField(page, '#booking-customer-country', guest.country);

    // ── 8. Toggle terms checkbox ──────────────────────────
    logger.info('bookRoom: accepting terms...');
    await page.evaluate(() => {
      const chk = document.querySelector('#chck-lopd');
      if (chk && !chk.checked) {
        chk.checked = true;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // ── 9. Submit ─────────────────────────────────────────
    logger.info('bookRoom: submitting...');
    await page.waitForSelector('#btn-AddBooking', { visible: true, timeout: config.booking.elementTimeout });
    await page.click('#btn-AddBooking');
    await debugShot(page, 'after-submit');

    // ── 10. Wait for Monei payment URL ────────────────────
    logger.info('bookRoom: waiting for Monei payment URL...');
    const paymentUrl = await paymentPromise;
    clearTimeout(paymentTimeout);

    logger.info('bookRoom: SUCCESS —', paymentUrl);
    return { success: true, paymentUrl };

  } catch (err) {
    clearTimeout(paymentTimeout);
    logger.error('bookRoom failed:', err.message);
    await debugShot(page, 'failure');
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { bookRoom };
