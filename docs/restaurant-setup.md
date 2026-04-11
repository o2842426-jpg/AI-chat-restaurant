# Restaurant Setup Guide

This guide is the fastest path to onboard a new restaurant safely.

## 1) Create the restaurant in admin

1. Start API and dashboard client.
2. Login as admin from `/login` (select `Admin` mode).
3. Open `Admin` page.
4. Create the restaurant with:
   - `name`
   - `email`
   - `password`
   - `telegram_group_id` (optional at first, recommended before go-live)
5. Confirm the restaurant appears in the list with `is_active = active`.

## 2) Configure Telegram group

1. Create a Telegram group for kitchen/order notifications.
2. Add the bot to that group.
3. Get the group chat id (usually like `-100...`).
4. Save it in admin as `telegram_group_id` for that restaurant.

## 3) Create Telegram bot token

1. Open Telegram and talk to [@BotFather](https://t.me/BotFather).
2. Create a bot with `/newbot`.
3. Copy the issued token.
4. In your bot `.env`, set:
   - `BOT_TOKEN=<token from BotFather>`
   - `RESTAURANT_ID=<restaurant id from admin list>`
   - `KITCHEN_GROUP_ID=<telegram_group_id>`

## 4) Required environment variables

### API (`dashboard`)

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### Bot (`bot`)

- `BOT_TOKEN`
- `RESTAURANT_ID`
- `KITCHEN_GROUP_ID` (optional but recommended)

## 5) Run services

### API

```bash
cd dashboard
npm start
```

### Dashboard client

```bash
cd dashboard-client
npm run dev
```

### Telegram bot

```bash
cd bot
python main.py
```

## 6) Test full flow

1. User opens bot and starts an order.
2. User adds items and confirms.
3. Kitchen receives notification (if `KITCHEN_GROUP_ID` configured).
4. Restaurant logs into dashboard and sees the order.
5. Move order lifecycle: `confirmed -> preparing -> ready -> delivered`.
6. Verify totals and item snapshots are preserved.

## 7) Activation / deactivation safety

- In admin page, disable (`is_active = 0`) to block a restaurant quickly.
- Disabled restaurants:
  - cannot login
  - cannot access protected restaurant API routes
- Admin routes continue to work.

## 8) Backup before onboarding go-live

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-sqlite.ps1
```

Store backups outside production server when possible.
