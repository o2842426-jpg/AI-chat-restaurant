"""Cart mutation use-cases (add/remove)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from models import add_item_to_order as _add_item_to_order
from models import remove_item_from_order as _remove_item_from_order

from .menu_service import get_menu_row
from .user_order_service import ensure_user_and_draft_order


def add_item_for_user(
    db: Session, tg_user, menu_item_id: int, quantity: int = 1
) -> tuple[bool, int, int]:
    """
    Add menu item to the user's draft order for this bot tenant.
    Returns (ok, user_id, order_id).
    """
    user, order = ensure_user_and_draft_order(db, tg_user)

    row = get_menu_row(db, menu_item_id, BOT_RESTAURANT_ID)
    if not row:
        return False, user.id, order.id

    _add_item_to_order(db, order.id, menu_item_id, quantity)
    return True, user.id, order.id


def remove_order_item(db: Session, order_item_id: int, user_id: int) -> None:
    _remove_item_from_order(db, order_item_id, user_id, BOT_RESTAURANT_ID)
