from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from db import Order, User

ORDER_TYPE_DINE_IN = "dine_in"
ORDER_TYPE_DELIVERY = "delivery"

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


def effective_order_type_for_validation(order: Order) -> str:
    """NULL / empty → delivery (backward compatible with pre-migration orders)."""
    ot = getattr(order, "order_type", None)
    if ot is None or str(ot).strip() == "":
        return ORDER_TYPE_DELIVERY
    s = str(ot).strip()
    if s == ORDER_TYPE_DINE_IN:
        return ORDER_TYPE_DINE_IN
    return ORDER_TYPE_DELIVERY


def set_draft_order_type(db: Session, user_id: int, restaurant_id: int, order_type: str) -> None:
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return
    if order_type == ORDER_TYPE_DINE_IN:
        order.order_type = ORDER_TYPE_DINE_IN
        order.customer_name_snapshot = None
        order.customer_phone_snapshot = None
        order.customer_address_snapshot = None
        order.table_number = None
        order.customer_input_step = "table_number"
    elif order_type == ORDER_TYPE_DELIVERY:
        order.order_type = ORDER_TYPE_DELIVERY
        order.table_number = None
        order.customer_input_step = "name"
    db.commit()


def resolve_customer_for_confirmation(
    db: Session, user_id: int, restaurant_id: int
) -> Tuple[str, Dict]:
    """
    Decide what the bot should do when user hits "تأكيد الطلب".

    Returns:
      ("no_draft", {}) |
      ("need_order_type", {}) |
      ("need_input", {"field": str, "label": str}) |
      ("review", {"mode": "dine_in"|"delivery", ...})
    """
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return "no_draft", {}

    if order.order_type is None or str(order.order_type).strip() == "":
        return "need_order_type", {}

    user = db.query(User).filter_by(id=user_id).first()

    if order.order_type == ORDER_TYPE_DINE_IN:
        tn = order.table_number
        if tn is None or str(tn).strip() == "":
            order.customer_input_step = "table_number"
            db.commit()
            return "need_input", {"field": "table_number", "label": "رقم الطاولة"}
        order.customer_input_step = "review"
        db.commit()
        return "review", {"mode": "dine_in", "table_number": str(tn).strip()}

    # delivery
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

    order.customer_input_step = "review"
    db.commit()
    customer = {
        "name": order.customer_name_snapshot,
        "phone": order.customer_phone_snapshot,
        "address": order.customer_address_snapshot,
    }
    return "review", {"mode": "delivery", "customer": customer}


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
    if step == "table_number":
        value = (text or "").strip()
        if value == "":
            return "need_input", {
                "field": "table_number",
                "label": "رقم الطاولة",
                "hint": "لا يمكن أن يكون فارغاً.",
            }
        order.table_number = value
        order.customer_input_step = "review"
        db.commit()
        return "review", {"mode": "dine_in", "table_number": value}

    if step not in ("name", "phone", "address"):
        return "not_expected", {"step": step}

    value = (text or "").strip()
    if value == "":
        label = dict(CUSTOMER_FIELDS).get(step, step)
        return "need_input", {"field": step, "label": label, "hint": "لا يمكن أن يكون فارغاً."}

    setattr(order, _order_attr_for_snapshot(step), value)
    if user is not None:
        setattr(user, _user_attr_for_value(step), value)

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
    return "review", {"mode": "delivery", "customer": customer}


def reset_customer_for_edit(db: Session, user_id: int, restaurant_id: int) -> None:
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return
    if order.order_type == ORDER_TYPE_DINE_IN:
        order.table_number = None
        order.customer_input_step = "table_number"
    else:
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
