# Restaurant Go-Live Playbook

Practical operator guide from "restaurant approved" to "first live order".

## 1) What to collect from the restaurant (approval stage)

Collect only these essentials:

- [ ] Restaurant name (official display name)
- [ ] Owner/manager login email (or agreed login identity)
- [ ] Owner contact phone (for onboarding follow-up)
- [ ] Menu list (item name + price + category)
- [ ] Telegram kitchen group link/id (or note: "you will create it for them")

Notes:
- If menu is not ready, launch with a starter menu (minimum 5 items).
- If no kitchen group exists, create one and continue onboarding.

## 2) Internal setup (operator steps)

1. Login as admin in dashboard.
2. Create restaurant in `Admin` page:
   - `name`
   - `email`
   - `password`
   - `telegram_group_id` (if available now)
3. Confirm restaurant appears with `is_active = active`.
4. Save credentials in your secure handoff note.
5. Add initial menu in dashboard (or by restaurant login).
6. If `telegram_group_id` missing, complete Telegram setup (section 3), then update it.

## 3) Telegram group linking

If restaurant already has a kitchen group:
- Ask them to add your bot to the group.
- Capture group id (format usually `-100...`).
- Save group id into restaurant record.

If no group exists:
- Create a new group named: `<Restaurant Name> Kitchen`.
- Add owner/manager + kitchen lead.
- Add bot account.
- Capture group id and save it in admin.

## 4) Bot deployment variables (per restaurant instance)

In bot `.env` for this restaurant instance:

- `BOT_TOKEN=<token from BotFather>`
- `RESTAURANT_ID=<restaurant id from admin table>`
- `KITCHEN_GROUP_ID=<telegram_group_id>`

Then run bot:

```bash
cd bot
python main.py
```

Verify startup logs show:
- DB path
- Restaurant ID

## 5) Menu setup minimum standard

Before go-live, ensure:

- [ ] At least 5 active menu items
- [ ] Categories are clear (e.g. Main, Drinks, Extras)
- [ ] Prices are filled for all items
- [ ] No test/fake items visible to customers

If menu is incomplete:
- Start with top-selling 5 items only.
- Add remaining items after first day.

## 6) First Live Order

## Goal
Prove full flow works end-to-end before announcing go-live.

## Steps
1. Place one test order from Telegram user flow.
2. Confirm order appears in dashboard orders list.
3. Verify kitchen group notification arrives.
4. Move order through lifecycle in dashboard:
   - `confirmed -> preparing -> ready -> delivered`
5. Confirm totals and item snapshots look correct.

## Pass criteria
- [ ] Order created from bot
- [ ] Dashboard can update status
- [ ] Kitchen receives message
- [ ] Final status reaches `delivered`

## 7) First-time training script (5-10 minutes)

Show only essentials to avoid confusion:

1. Where new orders appear.
2. How to change status in order sequence.
3. How to mark completed (`delivered`).
4. How to disable an unavailable menu item.
5. Who to contact if notifications stop.

Keep training focused on `Orders` first. Menu/statistics can be secondary.

## 8) 48-hour follow-up plan

After 24-48 hours:

- [ ] Ask if any orders were missed.
- [ ] Verify kitchen notifications still arrive.
- [ ] Review 3-5 real orders for status correctness.
- [ ] Remove confusing menu entries.
- [ ] Confirm owner can login without assistance.

Escalate immediately if:
- No notifications in kitchen group
- Orders stuck in one status
- Owner cannot login

## 9) Simple operator decision script

When restaurant approves:
1. Collect required inputs (section 1).
2. Create restaurant in admin.
3. If no Telegram group -> create one now.
4. If menu not ready -> publish starter 5 items.
5. Configure bot env and run bot.
6. Execute first live order test.
7. Train owner on Orders screen only.
8. Schedule 48-hour follow-up.

## 10) Restaurant Go-Live Checklist (copy for each new restaurant)

- [ ] Restaurant approved
- [ ] Restaurant created in admin
- [ ] Login credentials delivered
- [ ] `is_active` verified
- [ ] Telegram kitchen group linked
- [ ] Bot token configured
- [ ] `RESTAURANT_ID` configured
- [ ] `KITCHEN_GROUP_ID` configured
- [ ] Bot started successfully
- [ ] Minimum menu entered
- [ ] First test order completed
- [ ] Dashboard login verified
- [ ] Kitchen notification verified
- [ ] Lifecycle test completed
- [ ] 48-hour follow-up scheduled
