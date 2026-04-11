"""
Bot entrypoint.

Run from project repo root:
  python -m bot.main

Or from the `bot/` directory:
  python main.py
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Ensure imports like `from core...` and `from config...` resolve when running as a script.
_BOT_DIR = Path(__file__).resolve().parent
if str(_BOT_DIR) not in sys.path:
    sys.path.insert(0, str(_BOT_DIR))

from aiogram import Bot, Dispatcher

from config import BOT_TOKEN, BOT_RESTAURANT_ID
from db import init_db, _DB_PATH

from adapters.telegram.handlers import register_handlers


async def main() -> None:
    init_db()
    print("[startup] Bot starting")
    print(f"[startup] DB path: {_DB_PATH}")
    print(f"[startup] Restaurant ID: {BOT_RESTAURANT_ID}")
    bot = Bot(BOT_TOKEN)
    dp = Dispatcher()
    register_handlers(dp)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
