# Hostel Bot — Development Plan

## Goal
WhatsApp bot for Hostel Dos Estaciones (Alicante) that:
1. Chats with guests in WhatsApp
2. Collects: check-in/out dates, name, email, phone
3. Fills hotelgest.com booking form automatically via Puppeteer
4. Sends Monei hosted payment URL to the guest

## Stack
- **Runtime:** Node.js 22
- **WhatsApp:** whatsapp-web.js (unofficial, QR-scan, no Meta verification)
- **LLM:** GPT-4o-mini — tool-calling (data extractor only, anti-abuse)
- **Booking automation:** puppeteer (chromium via whatsapp-web.js)

## Confirmed Booking Flow (visual debug May 7 2026)
URL: `https://booking.hotelgest.com/v4/?pcode=1742`

1. Page loads with **calendar AUTO-OPEN** as a modal
2. Pick dates: click `[aria-label="Thursday, May 14, 2026"]` (start) and `[aria-label="Saturday, May 16, 2026"]` (end)
3. Click "Accept" button (find by text)
4. Click `.button-hg` (Search) → rooms appear
5. Click `.modalRate` (first room) → rate modal opens
6. Click `.addcart.btn-hg` (Add) → checkout form becomes visible
7. Fill: `#booking-customer-name`, `-surname`, `-email`
8. Phone: split into `#booking-customer-prefix-phone` (`<select>`) + `#booking-customer-phone` (digits only)
9. Toggle `#chck-lopd` checkbox (terms)
10. Click `#btn-AddBooking` (Submit)
11. **Monei JS** loads and calls `api.monei.com/v1/payment-methods?paymentId=XXX`
12. Intercept that request → extract `XXX` → build URL `https://secure.monei.com/payments/XXX`
13. Send URL to guest via WhatsApp

## Things That Tripped Us Up
- ❌ Setting hidden `dfrom/dto` doesn't update MobiScroll state
  → modal shows wrong night count → Add button disabled
- ❌ Calendar modal blocks all clicks until closed/accepted
- ❌ `waitForSelector` without `{ visible: true }` resolves on hidden DOM elements
- ❌ `#booking-customer-country` is text input, NOT `<select>` — `page.select()` fails
- ❌ Phone prefix is separate `<select>` (default `+41` Switzerland!) — must be split
- ❌ Form submit doesn't redirect — Monei is embedded inline via JS SDK
- ❌ Unhandled rejection from payment timeout crashed Node 22

## Files
All written and committed.

## Stages
1. [x] Init git repo
2. [x] Write all source files
3. [x] First commit + iterations
4. [x] npm install (194 packages)
5. [x] .env created (user managed)
6. [x] WhatsApp number ready (BlueStacks on Mac)
7. [x] Bot online (QR scanned)
8. [x] Conversation flow works (LLM collects data correctly)
9. [x] Visual debug session — full flow mapped, all selectors verified
10. [x] **End-to-end booking → Monei payment URL delivered ✅** (May 7 2026)

## Open Questions / Risks
- We always pick first available room — for MVP fine, future may add room choice
- Country field is autocomplete — typing might trigger dropdown that hides submit; safe to skip (not required)
- 30s payment timeout might be tight if hotelgest is slow
- Page language is English by default (`lang=en`); date aria-labels assume English. If site switches to Spanish, formatting breaks.
