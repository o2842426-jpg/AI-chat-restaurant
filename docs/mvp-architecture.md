# MVP architecture (refactor layout)

## Layout

| Area | Path | Role |
|------|------|------|
| Entry | `bot/main.py` | `init_db`, `Dispatcher`, `start_polling` |
| Legacy CLI | `bot/bot.py` | Thin wrapper → `main.main()` (same as `python main.py` from `bot/`) |
| Domain | `bot/core/` | No Telegram imports: cart/order/menu/pricing/upsell/router/validation |
| Telegram | `bot/adapters/telegram/` | Keyboards, `edit_or_send_followup`, aiogram handlers |
| Data | `bot/db.py`, `bot/models.py` | SQLAlchemy models + CRUD helpers |
| Upsell ML | `bot/upsell.py` | Dynamic co-occurrence scoring (used by `core/upsell_service.py`) |
| API Config | `dashboard/src/config.js` | Server constants/env-backed defaults |
| API Auth | `dashboard/src/middleware/auth.js` | JWT middlewares for restaurant/admin |
| API Stats Service | `dashboard/src/services/stats.js` | Period bounds and revenue series helpers |
| API Entry | `dashboard/server.js` | Routes + composition using extracted modules |
| Client Constants | `dashboard-client/src/constants/periods.js` | Shared period options |
| Client Token Helpers | `dashboard-client/src/lib/authToken.js` | Token read/write/clear helpers |
| Client UI State | `dashboard-client/src/components/ui/` | Shared loading/error components |

## Run

From repo root:

```bash
cd bot
python main.py
```

or:

```bash
python -m bot.main
```

(requires `.env` with `BOT_TOKEN` in `bot/` or cwd as loaded by `config.py`.)

## Extension points

- `core/ai_interpretation_service.py` — future NL → actions.
- `core/session_service.py` — future FSM / external session store.
- `dashboard/src/` — future split into route modules/repositories without changing API contract.
