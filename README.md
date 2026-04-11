# AI-chat-restaurant

## Telegram bot

- **Preferred:** from `bot/`: `python main.py`  
- **Or** from repo root: `python -m bot.main`  
- **Legacy:** `python bot.py` (inside `bot/`)

Set `BOT_TOKEN` (and optional `KITCHEN_GROUP_ID`, `RESTAURANT_ID`) in `.env`. See `docs/mvp-architecture.md` for the post-refactor layout.

## Dashboard API

- `cd dashboard`
- `npm start`
- Logs show startup info including DB path.

## Dashboard client

- `cd dashboard-client`
- `npm run dev`
- `npm run build` for production bundle check

Public landing page is available at `/landing`.

## Commercial ops quick links

- **First paying client / production readiness:** `docs/FIRST_CLIENT_READINESS.md` (start here)
- Env templates: `bot/.env.example`, `dashboard/.env.example`
- Restaurant onboarding: `docs/restaurant-setup.md`
- Go-live playbook: `docs/restaurant-go-live-playbook.md`
- Launch checklist: `docs/mvp-launch-checklist.md`
- SQLite backup: `scripts/backup-sqlite.ps1`

### Web / QR ordering (customers)

- URL pattern: `https://yourdomain.com/order/<restaurant_id>` (same id as in Admin).
- Restaurant staff must log in to the **same** `restaurant_id` to see those orders.

