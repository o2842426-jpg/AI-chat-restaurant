# MVP Launch Checklist

This checklist is for final MVP readiness with current architecture.

## 1) Environment

- Set `BOT_TOKEN` in bot `.env`.
- Set `KITCHEN_GROUP_ID` if kitchen notifications are required.
- Set API secrets in dashboard environment:
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN`
  - `ADMIN_EMAIL`
  - `ADMIN_PASSWORD`
- Ensure all services use the same `restaurant_bot.db` file.

## 2) Build and startup

- Bot:
  - `cd bot`
  - `python -m py_compile db.py core\\cart_service.py core\\order_service.py adapters\\telegram\\handlers.py`
  - `python main.py`
- Dashboard API:
  - `cd dashboard`
  - `node --check server.js`
  - `npm start`
- Dashboard client:
  - `cd dashboard-client`
  - `npm run build`
  - `npm run dev`

## 3) Functional smoke tests

- Auth:
  - Restaurant login works.
  - Admin login works.
- Bot order flow:
  - Start bot -> new order -> choose category/item -> add item.
  - Upsell yes/no both work.
  - Cart shows items and total.
  - Remove item from cart works.
  - Confirm order works and sends to kitchen when configured.
  - Repeat last order works.
- Dashboard:
  - Orders list loads and status update works.
  - Menu add/update/delete works only for the authenticated restaurant.
  - Stats page loads for all period filters.
  - Admin can list/add restaurants.

## 4) Security and data isolation checks

- Restaurant A cannot update Restaurant B order status.
- Restaurant A cannot update/delete Restaurant B menu items.
- Unauthorized requests return 401.

## 5) Operational readiness

- Backup `restaurant_bot.db` before launch.
  - PowerShell: `powershell -ExecutionPolicy Bypass -File .\scripts\backup-sqlite.ps1`
  - Keep at least 14 days of backups.
- Restore drill (required once before production):
  - Copy latest backup to a temp path.
  - Start API and bot against restored DB.
  - Validate login + one order lifecycle update.
- Define restart procedure for bot/API processes.
- Capture startup logs for first production run.

## 6) Done criteria

- All checks above pass.
- No compile/lint/build errors.
- Manual smoke test completed end-to-end.
