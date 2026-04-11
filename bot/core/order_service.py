"""Order confirmation and repeat-last-order flows."""

from __future__ import annotations

from datetime import datetime
from typing import List, Tuple

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from db import Order, OrderItem, MenuItem, OrderStatusHistory
from models import get_last_confirmed_order, get_or_create_draft_order

from .pricing_service import line_subtotal
from .types import ConfirmOrderResult


def build_order_summary_lines(
    db: Session, order_id: int, restaurant_id: int
) -> Tuple[List[str], float]:
    """Build human-readable lines and total for a given order (snapshots preferred)."""
    items = db.query(OrderItem).filter_by(order_id=order_id).all()
    menu_ids = [it.menu_item_id for it in items]
    menu_rows = (
        db.query(MenuItem)
        .filter(MenuItem.id.in_(menu_ids), MenuItem.restaurant_id == restaurant_id)
        .all()
        if menu_ids
        else []
    )
    menu_by_id = {row.id: row for row in menu_rows}
    lines: List[str] = []
    total = 0.0
    for it in items:
        mi = menu_by_id.get(it.menu_item_id)
        display_name = it.item_name_snapshot or (mi.name if mi else None)
        if not display_name:
            continue
        unit_price = (
            float(it.unit_price_snapshot)
            if it.unit_price_snapshot is not None
            else (float(mi.price) if mi else 0.0)
        )
        sub = (
            float(it.line_total_snapshot)
            if it.line_total_snapshot is not None
            else line_subtotal(unit_price, it.quantity)
        )
        total += sub
        lines.append(f"{display_name} x{it.quantity}")
    return lines, total


def confirm_draft_order(db: Session, user_id: int, restaurant_id: int) -> ConfirmOrderResult:
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        return ConfirmOrderResult(ok=False, error="no_draft")

    # Domain rule: require customer snapshots before confirming.
    if (
        order.customer_name_snapshot is None
        or str(order.customer_name_snapshot).strip() == ""
        or order.customer_phone_snapshot is None
        or str(order.customer_phone_snapshot).strip() == ""
        or order.customer_address_snapshot is None
        or str(order.customer_address_snapshot).strip() == ""
    ):
        return ConfirmOrderResult(ok=False, error="missing_customer")

    items = db.query(OrderItem).filter_by(order_id=order.id).all()
    if not items:
        return ConfirmOrderResult(ok=False, error="empty")

    header = [f"Order #{order.id}"]
    body_lines, total = build_order_summary_lines(db, order.id, restaurant_id)
    customer_lines = [
        "بيانات العميل:",
        f"- الاسم: {order.customer_name_snapshot}",
        f"- الهاتف: {order.customer_phone_snapshot}",
        f"- العنوان: {order.customer_address_snapshot}",
        "",
    ]
    kitchen_lines = header + customer_lines + body_lines + [f"\nTotal: {total:.2f}"]
    kitchen_text = "\n".join(kitchen_lines)

    now = datetime.utcnow()
    # Audit: draft -> confirmed
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            restaurant_id=restaurant_id,
            from_status="draft",
            to_status="confirmed",
            changed_at=now,
            changed_by_role="telegram_bot",
            changed_by_user_id=user_id,
        )
    )
    order.status = "confirmed"
    order.total_amount = total
    order.confirmed_at = now
    order.updated_at = now
    db.commit()

    return ConfirmOrderResult(ok=True, order_id=order.id, kitchen_text=kitchen_text)


def repeat_last_order_into_draft(db: Session, user_id: int, restaurant_id: int) -> Tuple[bool, str]:
    """
    Copy last non-draft order into current draft for the same restaurant. Returns (success, message).
    """
    last_order = get_last_confirmed_order(db, user_id, restaurant_id)
    if not last_order:
        return False, "لا يوجد طلبات سابقة."

    new_order = get_or_create_draft_order(db, user_id, restaurant_id)
    db.query(OrderItem).filter_by(order_id=new_order.id).delete()
    db.commit()

    old_items = db.query(OrderItem).filter_by(order_id=last_order.id).all()
    for item in old_items:
        db.add(
            OrderItem(
                order_id=new_order.id,
                menu_item_id=item.menu_item_id,
                quantity=item.quantity,
                item_name_snapshot=item.item_name_snapshot,
                unit_price_snapshot=item.unit_price_snapshot,
                line_total_snapshot=item.line_total_snapshot,
            )
        )
    new_order.updated_at = datetime.utcnow()
    db.commit()

    lines = ["تم إنشاء طلب جديد بناءً على آخر طلب:"]
    items_new = db.query(OrderItem).filter_by(order_id=new_order.id).all()
    menu_ids = [it.menu_item_id for it in items_new]
    menu_rows = (
        db.query(MenuItem)
        .filter(MenuItem.id.in_(menu_ids), MenuItem.restaurant_id == restaurant_id)
        .all()
        if menu_ids
        else []
    )
    menu_by_id = {row.id: row for row in menu_rows}
    total = 0.0
    for it in items_new:
        mi = menu_by_id.get(it.menu_item_id)
        display = it.item_name_snapshot or (mi.name if mi else "?")
        unit_price = (
            float(it.unit_price_snapshot)
            if it.unit_price_snapshot is not None
            else (float(mi.price) if mi else 0.0)
        )
        sub = (
            float(it.line_total_snapshot)
            if it.line_total_snapshot is not None
            else line_subtotal(unit_price, it.quantity)
        )
        total += sub
        lines.append(f"{display} x{it.quantity} = {sub:.2f}")
    lines.append(f"\nالإجمالي التقريبي: {total:.2f}")
    lines.append("\nأرسل 'طلب جديد' لتأكيد الطلب الحالي.")

    return True, "\n".join(lines)


def confirm_draft_for_bot_user(db: Session, user_id: int) -> ConfirmOrderResult:
    """Confirm draft for the configured bot restaurant (thin wrapper)."""
    return confirm_draft_order(db, user_id, BOT_RESTAURANT_ID)


def repeat_last_for_bot_user(db: Session, user_id: int) -> Tuple[bool, str]:
    return repeat_last_order_into_draft(db, user_id, BOT_RESTAURANT_ID)
