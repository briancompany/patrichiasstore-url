# Reliable payment start (Outbox + Worker)

## What the customer will experience
1. They tap "Pay". The order and a payment job are saved together, in one step. Checkout never fails just because Pesapal is slow.
2. They see a "Preparing secure payment..." screen. The worker contacts Pesapal in the background, and the customer is taken to the Pesapal page as soon as it's ready, usually within a few seconds.
3. If Pesapal keeps failing after 3 tries, the order is marked "Declined". The customer gets an email in the same style as the success receipt, with a "Retry order" button, and the screen shows the same message.
4. M-Pesa Paybill (the backup option) stays available on that screen the whole time.

## Changes to your proposal (and why)
- **Pesapal hands back a payment page link.** The customer can't pay until the worker gets that link, so "checkout succeeds immediately" means the order is safe right away. The payment page opens a moment later.
- **No 30-second polling.** Polling every 30 seconds runs 2,880 times a day and keeps the database awake even with no orders, which raises Cloud costs. Instead:
  - The worker starts the moment a payment job is saved.
  - Retries are scheduled only while failed jobs are waiting (after 30s, then 2 minutes), and stop once nothing is left.
  - A single safety check every 10 minutes catches anything that slipped through.
- **Relay and worker are one function.** The "pending → queued" step is merged into the worker, which claims jobs safely so two runs never process the same one. Statuses are kept as you listed them.

## Technical details
- Migration:
  - Add the order statuses `pending_payment`, `payment_initiated` and `declined`.
  - Create a `payment_tasks` table with your columns, plus `next_attempt_at`, `redirect_url` and `pesapal_tracking_id`. Customers can only read it through a function that takes the order ID; only admins and the system can see the full table.
  - Add `create_order_with_payment_task(order, items, contact)` as a security-definer function. One transaction inserts the order, items, tracking code, contact email and task, with prices and stock validated on the server.
  - Add `claim_payment_tasks(limit 5)` using `FOR UPDATE SKIP LOCKED`.
- Edge function `process-payment-tasks`:
  - Uses the Pesapal logic moved out of `pesapal-pay`.
  - Handles a batch, then exits.
  - On success it stores the link and sets the order to `payment_initiated`. On failure it increases `retry_count` and pushes back `next_attempt_at`. At the limit it marks the task `dead`, sets the order to `declined` and sends the Gmail failure email.
- The worker is woken by `pg_net` from an insert trigger. A 10-minute cron job acts as the backstop.
- `Checkout.tsx`, `Order.tsx` and `Payment.tsx` call the new function, then check the task status every 2s and redirect when the link appears. The direct `pesapal-pay` call is removed. That function stays deployed but unused, so older open tabs don't break.
- No changes to how payments are confirmed: `pesapal-ipn`, `pesapal-status`, stock claiming and receipts work as before.
- Admin Orders and System Monitor show the new statuses and a payment-jobs panel with a manual retry.
- Test from start to finish with a real order: success, simulated Pesapal failure leading to retries, then dead, then the email.
