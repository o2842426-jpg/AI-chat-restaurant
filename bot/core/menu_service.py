"""Menu queries (thin over models/db)."""

from __future__ import annotations

from typing import List, Optional

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from db import MenuItem
from models import get_menu_by_category as _get_menu_by_category


def get_items_by_category(db: Session, category: str) -> List[MenuItem]:
    return _get_menu_by_category(db, category, BOT_RESTAURANT_ID)


def get_menu_row(db: Session, menu_item_id: int, restaurant_id: int) -> Optional[MenuItem]:
    return (
        db.query(MenuItem)
        .filter(MenuItem.id == menu_item_id, MenuItem.restaurant_id == restaurant_id)
        .filter(((MenuItem.is_active == 1) | (MenuItem.is_active.is_(None))))
        .first()
    )
