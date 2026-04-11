# bot/core/user_order_service.py
from __future__ import annotations

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from models import get_or_create_user, get_or_create_draft_order


def ensure_user(db: Session, tg_user):
    """
    Returns user row for Telegram user, creating it if needed.
    """
    return get_or_create_user(db, tg_user)


def ensure_user_and_draft_order(db: Session, tg_user):
    """
    Returns (user, draft_order) for this bot's restaurant tenant.
    """
    user = get_or_create_user(db, tg_user)
    order = get_or_create_draft_order(db, user.id, BOT_RESTAURANT_ID)
    return user, order
