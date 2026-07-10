
## Ground rules (apply to both phases)

- **Additive only.** No changes to existing tables, admin dashboard, products table, pricing, checkout, payments, or APK. Only NEW tables (`staff_users`, `customers`, `quotations`, `quotation_items`, sequence + indexes) and NEW routes/pages.
- **Brand parity.** Reuse existing tokens in `index.css`, Plus Jakarta Sans, existing logo, existing purple palette, existing sticky mobile action bar patterns. No new colors, no new font.
- **Live domain everywhere** login links appear: `https://patrichiasstore-url.vercel.app/`
- **Security.** RLS on every new table. Anon has no access. Only authenticated staff/admin sessions can read/write quotation data. Admin remains the only role that manages staff.
- **Warm-up + caching.** Extend `src/lib/warmup.ts` and existing `useProductCache` / IndexedDB layer to also prewarm quotation & customer queries. No parallel cache system.
- **No public signup.** Auth is admin-provisioned only.

---

## PHASE 1 — Auth, roles, staff management, staff shell

Goal: admin can create staff, staff can log in with email + phone, staff sees an empty dashboard shell. No quotation logic yet.

### 1.1 Database (single migration)

- `staff_users` — `user_id uuid PK references auth.users`, `email citext unique`, `phone text unique`, `full_name text`, `role text check in ('admin','quotation_staff')`, `is_active bool default true`, timestamps. GRANTs for authenticated + service_role. RLS: only admins can read/write via `is_admin()`; each staff can read their own row.
- `has_staff_role(_uid uuid, _role text)` SECURITY DEFINER helper (mirrors existing `is_admin()` pattern) for reuse in later phase.
- Indexes: `staff_users(email)`, `staff_users(phone)`.

### 1.2 Edge functions

- `create-staff-account` (service role): admin-only. Input: name, email, phone, role. Creates the `auth.users` row with a deterministic password derived from the phone (or random then reset), then inserts `staff_users`. Validates admin JWT via `is_admin()`. Returns `{ email, phone }` so admin can share via WhatsApp.
- `deactivate-staff-account` (service role): admin-only. Sets `is_active=false`, revokes sessions.
- Both functions live in `supabase/functions/*/index.ts`, follow existing CORS + rate-limit patterns from `confirm-payment`.

### 1.3 Staff login (email + phone)

- New page `/staff/login`. Two inputs: email, phone. Client normalizes phone (07… → 254…).
- Client edge call `staff-login` (service role): looks up `staff_users` where email+phone match AND `is_active`. If match, mints a session by calling `auth.admin.generateLink({ type: 'magiclink' })` OR signs in with the fixed password associated with that account. Returns the Supabase session; frontend calls `supabase.auth.setSession(...)`.
- Session persistence: existing `supabase-js` already persists to localStorage — no extra work. Route guard checks `staff_users.is_active` on load.

### 1.4 Admin UI additions

- New tab in `AdminLayout` sidebar: **Staff** → `/admin/staff`.
- Table of staff with columns: Name, Email, Phone, Role, Active, Actions.
- "Add Staff" dialog → calls `create-staff-account`.
- WhatsApp icon per row → opens `https://wa.me/<254…>?text=<prefilled>` with:
  > Hello {name}, your Patrichia's Store staff account is ready.
  > Login: https://patrichiasstore-url.vercel.app/staff/login
  > Email: {email}   Phone: {phone}
- Deactivate / reactivate buttons.

### 1.5 Staff dashboard shell

- New route `/staff` (guarded: must be authenticated + role `quotation_staff` or `admin`).
- Layout matches existing brand. Four cards: **New Quotation**, **Quotation History**, **Customers**, **Download App** (linking to existing APK URL used in current app).
- Floating WhatsApp button reuses `WhatsAppButton.tsx` with the store's default `0726075180` (already configurable via admin settings — no change).
- Cards navigate to placeholder pages ("Coming in phase 2").

### 1.6 Warm-up

- Extend `src/lib/warmup.ts` to also ping `staff_users` (count only) so cold-start is warm for staff login.

**Phase 1 exit criteria:** admin can create a staff account, share it over WhatsApp, that staff can log in on the live URL, land on their dashboard, and stay logged in across reloads. Existing customer flow, admin dashboard, and checkout are untouched.

---

## PHASE 2 — Customers, quotation builder, PDF, WhatsApp send

Goal: fully working quotation flow with premium PDF.

### 2.1 Database (single migration)

- `customers` — `id uuid PK`, `name text`, `phone text`, `school_or_company text null`, `created_by uuid references staff_users`, timestamps. Unique on `(phone)` (case-insensitive normalized).
- `quotation_status` enum: `draft | final | sent | accepted | cancelled`.
- `quotations` — `id uuid PK`, `quotation_number text unique` (server-generated), `customer_id uuid references customers`, `created_by uuid references staff_users`, `status quotation_status default 'draft'`, `subtotal int`, `grand_total int`, `valid_until date`, `notes text`, timestamps.
- `quotation_items` — `id uuid PK`, `quotation_id uuid references quotations on delete cascade`, `product_id uuid references products null`, `product_name text` (snapshot), `size text`, `unit_price int` (snapshot — locked), `quantity int check > 0`, `line_total int`.
- Sequence + trigger: `quotation_seq`; before-insert trigger sets `quotation_number = 'PKQ-' || to_char(now(),'YYYYMMDD') || '-' || lpad(nextval('quotation_seq')::text, 4, '0')`.
- Update-guard trigger on `quotation_items`: reject UPDATE/DELETE when parent `quotations.status <> 'draft'`.
- Indexes: `customers(name)`, `customers(phone)`, `quotations(quotation_number)`, `quotations(created_at)`, `quotations(status)`, `quotations(customer_id)`, `quotation_items(quotation_id)`, `quotation_items(product_id)`.
- GRANTs to authenticated + service_role. RLS: any authenticated staff (`has_staff_role`) can read/write; admin can do everything.

### 2.2 Staff pages

- `/staff/quotations/new`
  - Customer step: search-as-you-type over `customers` (debounced 250ms); "Create new customer" inline.
  - Line-item builder: reuse existing product picker + size/price data. Autosave to `quotations` (`status='draft'`) every 800ms.
  - Save Draft / Save Final buttons. On Final, items become read-only.
- `/staff/quotations` — paginated list with instant search across number/customer/phone/product/status/date.
- `/staff/quotations/:id` — view + PDF preview + WhatsApp send.
- `/staff/customers` — paginated list, search, "one-click duplicate last quotation".
- Staff can add products via existing product form — same shared table, just guard the route by `has_staff_role`.

### 2.3 PDF

- Client-side `@react-pdf/renderer` (already used or lightweight to add).
- Layout: logo top-left, store block top-right, thin purple accent divider, customer + quotation meta card, itemized table with zebra rows, right-aligned grand total in a highlighted band, signature line, footer with contact + validity + small mark.
- Upload rendered PDF to Storage bucket `quotations` (private, admin+staff SELECT). Return signed URL valid 7 days.

### 2.4 WhatsApp send

- Per-quotation button under PDF preview: opens `https://wa.me/<customer 254…>?text=` with:
  > Hello {customer name}, please find quotation {PKQ-…} attached — total KES {amount}. View PDF: {signed url}. — Patrichia's Store
- Separate from the floating store contact button.

### 2.5 Cache + warm-up

- Extend `useProductCache` to also pre-hydrate the top 100 recent customers + open drafts on staff dashboard mount.
- Add `staff-warmup` calls in `warmup.ts` for `customers` and `quotations` (HEAD count only).

**Phase 2 exit criteria:** staff can build, save, finalize, download, and WhatsApp a premium PDF quotation. Past-quotation prices never change if a product price is later edited.

---

## Technical notes (for review)

- Login via email+phone is implemented as a server-side verified lookup that then signs the user in with a Supabase auth session — we do NOT bypass Supabase auth or roll a custom JWT.
- The `EXISTS`-on-orders bug just fixed on the checkout tables is a good reminder: new RLS policies for `quotation_items` will not put `EXISTS` on a table the same role can't SELECT — FKs handle referential integrity.
- All new pages will be code-split (`React.lazy`) so the customer-facing bundle does not grow.
- CSP in `vercel.json` already allows Supabase + `blob:` — PDF generation and storage links will work without header changes.

Reply **"go"** to start Phase 1, or tell me what to adjust.
