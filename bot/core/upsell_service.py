"""
Post-add upsell: dynamic (Level 5) with fallback to static rules (Level 4).
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from db import MenuItem
from config import BOT_RESTAURANT_ID
from models import get_menu_item_by_name
from upsell import recommend_upsell_dynamic

from .types import PostAddUpsell

# Level 4 — static upsell: key = menu category, suggest_name = exact name in menu_items
UPSELL_RULES = {
    "Burgers": {
        "message": "🍟 هل تريد إضافة بطاطا (Fries) مع طلبك؟",
        "suggest_name": "Fries",
    },
    "Pizza": {
        "message": "🥤 هل تريد مشروباً مع البيتزا؟ (مثال: كولا)",
        "suggest_name": "Cola",
    },
}

_SIMPLE_FOLLOWUP = (
    "يمكنك متابعة الطلب من «المنيو» أو «سلة الطلب»."
)


def resolve_post_add_upsell(
    db: Session,
    added_menu_item_id: int,
    draft_order_id: int,
    user_id: int,
) -> PostAddUpsell:
    """
    Pure DB logic: what to show after adding an item.
    Caller handles Telegram (callback.answer, keyboards).
    """
    row = (
        db.query(MenuItem)
        .filter(MenuItem.id == added_menu_item_id, MenuItem.restaurant_id == BOT_RESTAURANT_ID)
        .first()
    )
    if not row:
        return PostAddUpsell(
            kind="none",
            added_item_name="",
            message=_SIMPLE_FOLLOWUP,
        )

    dyn = None
    try:
        dyn = recommend_upsell_dynamic(
            db, row.restaurant_id, user_id, row, draft_order_id
        )
    except Exception:
        logging.exception("recommend_upsell_dynamic")
        dyn = None

    if dyn:
        suggested, upsell_msg = dyn
        if suggested.id != row.id:
            return PostAddUpsell(
                kind="dynamic",
                added_item_name=row.name,
                message=f"✅ تمت إضافة: {row.name}\n\n{upsell_msg}",
                suggested_menu_item_id=suggested.id,
            )

    rule = UPSELL_RULES.get(row.category)
    if not rule:
        return PostAddUpsell(
            kind="simple_followup",
            added_item_name=row.name,
            message=f"✅ تمت إضافة: {row.name}\n\n{_SIMPLE_FOLLOWUP}",
        )

    suggested = get_menu_item_by_name(
        db, row.restaurant_id, rule["suggest_name"]
    )
    if not suggested or suggested.id == row.id:
        return PostAddUpsell(
            kind="simple_followup",
            added_item_name=row.name,
            message=f"✅ تمت إضافة: {row.name}\n\n{_SIMPLE_FOLLOWUP}",
        )

    return PostAddUpsell(
        kind="static",
        added_item_name=row.name,
        message=f"✅ تمت إضافة: {row.name}\n\n{rule['message']}",
        suggested_menu_item_id=suggested.id,
    )
