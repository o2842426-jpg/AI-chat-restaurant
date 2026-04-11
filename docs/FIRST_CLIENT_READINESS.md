# First client — business & production readiness

Use this as your **master checklist** before you put a paying restaurant live.  
(You already have deeper detail in `restaurant-go-live-playbook.md`, `mvp-launch-checklist.md`, and `restaurant-setup.md`.)

---

## 1) What to agree with the client (non-technical)

- Scope: Telegram ordering, web/QR ordering, dashboard — what is **in** vs **out**.
- Who owns: domain name, hosting bill, Telegram bot account.
- Support: how they reach you on day 1 (WhatsApp / phone / email).
- Data: they understand orders are stored in **your** SQLite DB on the server you deploy.

---

## 2) What to collect from the restaurant (technical onboarding)

- Official **restaurant name**.
- **Owner / manager email** + password policy (you set initial password in Admin).
- **Menu**: name, category, price per item (minimum ~5 items for a clean launch).
- **Telegram kitchen group**: link or ID, and confirm **your bot is added** to the group.
- (Optional) **Logo / branding** if you customize the client later.

---

## 3) Production environment (must-do)

| Item | Why |
|------|-----|
| **VPS or cloud server** (Linux or Windows) with stable internet | Host API + static files + bot + DB |
| **HTTPS + domain** | Browsers and QR links expect `https://yourdomain.com` |
| **Reverse proxy** (e.g. nginx or Caddy) | Terminate TLS, proxy `/api` → Node `3000`, serve static `dist/` — see `docs/nginx-api.example.conf` |
| **Nginx `proxy_pass`** | Must **keep** the `/api` prefix on upstream (wrong strip → `401 unauthorized` on `/api/public/...` and broken login). Example: `location /api/ { proxy_pass http://127.0.0.1:3000/api/; }` |
| **Strong secrets** | Change default `JWT_SECRET`, `ADMIN_PASSWORD` — never use repo defaults |
| **Same SQLite file** | Bot + API must point at the **same** `restaurant_bot.db` path on the server |
| **Firewall** | Open 80/443 only; Node listens on localhost behind proxy |

---

## 4) Environment variables (copy from `.env.example`)

- **`bot/.env.example`** → copy to `bot/.env` and fill.
- **`dashboard/.env.example`** → copy to `dashboard/.env` and fill.

Minimum mental model:

- **Bot:** `BOT_TOKEN`, `RESTAURANT_ID`, `KITCHEN_GROUP_ID` (per deployment instance).
- **API:** `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`.
- **If the server cannot reach Telegram** (`ETIMEDOUT` to `api.telegram.org`): set **`SKIP_TELEGRAM_KITCHEN=true`** in `bot/.env` (dashboard loads it). Kitchen uses **dashboard orders** instead.

---

## 5) Build & deploy (short)

```bash
# Client (production assets)
cd dashboard-client && npm ci && npm run build
# Serve dist/ with nginx/Caddy or copy to hosting

# API
cd dashboard && npm ci && npm start
# Or use PM2: pm2 start server.js --name restaurant-api
```

Point the reverse proxy to:

- Static files: `dashboard-client/dist/` (SPA: `try_files` → `index.html`).
- API: `http://127.0.0.1:3000` (path `/api`).

---

## 6) Web / QR ordering URL

- Customer link: **`https://yourdomain.com/order/<restaurant_id>`**
- `<restaurant_id>` must match the row in **Admin** (`restaurants.id`).
- Staff dashboard login must **match the same restaurant** to see those orders.

---

## 7) Backups (non-negotiable)

- **Before go-live:** run `scripts/backup-sqlite.ps1` (or copy `restaurant_bot.db` manually on Linux).
- **Schedule:** daily copy to another disk or object storage; keep **≥14 days** per `backup-sqlite.ps1` default.
- **Once:** restore a backup on a test machine and confirm login + one order.

---

## 8) Day-1 smoke test (before telling the client “live”)

1. Admin login → restaurant **active** → menu items **active**.
2. Telegram: test order end-to-end (or skip if `SKIP_TELEGRAM_KITCHEN`).
3. Web: open `/order/<id>`, place order → appears in **Orders** with **ويب** source.
4. Dashboard: change order status **confirmed → preparing → ready → delivered**.
5. Stats page loads for the restaurant.

---

## 9) Where to read next

| Doc | Use |
|-----|-----|
| `restaurant-go-live-playbook.md` | Step-by-step from approval to first order |
| `mvp-launch-checklist.md` | Security + env + smoke tests |
| `restaurant-setup.md` | Admin + Telegram + menu |

You are **ready for the first client** when sections 3–7 are done and section 8 passes.
