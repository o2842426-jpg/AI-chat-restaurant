from __future__ import annotations

from typing import Optional, Tuple, Dict, List

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from db import Order, User


CUSTOMER_FIELDS: List[Tuple[str, str]] = [
    ("name", "الاسم"),
    ("phone", "رقم الهاتف"),
    ("address", "العنوان"),
]


def _order_attr_for_snapshot(field_key: str) -> str:
    return f"customer_{field_key}_snapshot"


def _user_attr_for_value(field_key: str) -> str:
    return f"customer_{field_key}"


def _get_first_missing_field(order: Order, field_keys: List[str]) -> Optional[str]:
    for k in field_keys:
        v = getattr(order, _order_attr_for_snapshot(k))
        if v is None or str(v).strip() == "":
            return k
    return None


def resolve_customer_for_confirmation(
    db: Session, user_id: int, restaurant_id: int
) -> Tuple[str, Dict]:
    """
    Decide what the bot should do when user hits "تأكيد الطلب".

    Returns:
      ("no_draft", {...}) |
      ("need_input", {"field": "name"|"phone"|"address"}) |
      ("review", {"customer": {...}})
    """
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return "no_draft", {}

    user = db.query(User).filter_by(id=user_id).first()

    # Prefill order snapshots from user's defaults when possible.
    for key, _ in CUSTOMER_FIELDS:
        order_attr = _order_attr_for_snapshot(key)
        user_attr = _user_attr_for_value(key)
        cur = getattr(order, order_attr)
        if (cur is None or str(cur).strip() == "") and user is not None:
            v = getattr(user, user_attr, None)
            if v is not None and str(v).strip() != "":
                setattr(order, order_attr, str(v).strip())

    field_keys = [k for k, _ in CUSTOMER_FIELDS]
    missing = _get_first_missing_field(order, field_keys)

    if missing:
        order.customer_input_step = missing
        db.commit()
        label = dict(CUSTOMER_FIELDS)[missing]
        return "need_input", {"field": missing, "label": label}

    # All fields exist -> ask for approval/edit.
    order.customer_input_step = "review"
    db.commit()
    customer = {
        "name": order.customer_name_snapshot,
        "phone": order.customer_phone_snapshot,
        "address": order.customer_address_snapshot,
    }
    return "review", {"customer": customer}


def apply_customer_text_for_input(
    db: Session, user_id: int, restaurant_id: int, text: str
) -> Tuple[str, Dict]:
    """
    Apply incoming text to the currently expected customer field.
    """
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order or not order.customer_input_step:
        return "no_input", {}

    user = db.query(User).filter_by(id=user_id).first()

    step = order.customer_input_step
    if step not in ("name", "phone", "address"):
        return "not_expected", {"step": step}

    value = (text or "").strip()
    if value == "":
        # Keep step as-is and ask again.
        label = dict(CUSTOMER_FIELDS).get(step, step)
        return "need_input", {"field": step, "label": label, "hint": "لا يمكن أن يكون فارغاً."}

    setattr(order, _order_attr_for_snapshot(step), value)
    # Keep user defaults in sync as a convenience for next orders.
    if user is not None:
        setattr(user, _user_attr_for_value(step), value)

    # Move to next missing field or review.
    field_keys = [k for k, _ in CUSTOMER_FIELDS]
    missing = _get_first_missing_field(order, field_keys)

    if missing:
        order.customer_input_step = missing
        db.commit()
        label = dict(CUSTOMER_FIELDS)[missing]
        return "need_input", {"field": missing, "label": label}

    order.customer_input_step = "review"
    db.commit()
    customer = {
        "name": order.customer_name_snapshot,
        "phone": order.customer_phone_snapshot,
        "address": order.customer_address_snapshot,
    }
    return "review", {"customer": customer}


def reset_customer_for_edit(db: Session, user_id: int, restaurant_id: int) -> None:
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return
    order.customer_name_snapshot = None
    order.customer_phone_snapshot = None
    order.customer_address_snapshot = None
    order.customer_input_step = "name"
    db.commit()


def get_customer_input_step(
    db: Session, user_id: int, restaurant_id: int
) -> Optional[str]:
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return None
    return order.customer_input_step

