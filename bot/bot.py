"""
Legacy entrypoint — prefer `python main.py` or `python -m bot.main`.

Keeps `python bot.py` working when run from the `bot/` directory.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

_BOT_DIR = Path(__file__).resolve().parent
if str(_BOT_DIR) not in sys.path:
    sys.path.insert(0, str(_BOT_DIR))

from main import main

if __name__ == "__main__":
    asyncio.run(main())
