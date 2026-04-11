"""Draft cart read model."""

from __future__ import annotations

from sqlalchemy.orm import Session

from config import BOT_RESTAURANT_ID
from db import Order, OrderItem, MenuItem

from .pricing_service import line_subtotal
from .types import CartLine, CartSnapshot


def get_cart_snapshot(db: Session, user_id: int) -> CartSnapshot | None:
    """
    Returns None if there is no draft order or it has no line items.
    Scoped to this bot's restaurant.
    """
    order = (
        db.query(Order)
        .filter_by(
            user_id=user_id,
            status="draft",
            restaurant_id=BOT_RESTAURANT_ID,
        )
        .first()
    )
    if not order:
        return None

    items = db.query(OrderItem).filter_by(order_id=order.id).all()
    if not items:
        return None

    menu_ids = [it.menu_item_id for it in items]
    menu_rows = (
        db.query(MenuItem)
        .filter(MenuItem.id.in_(menu_ids), MenuItem.restaurant_id == BOT_RESTAURANT_ID)
        .all()
    )
    menu_by_id = {row.id: row for row in menu_rows}

    lines: list[CartLine] = []
    for it in items:
        mi = menu_by_id.get(it.menu_item_id)
        name = it.item_name_snapshot or (mi.name if mi else None)
        if not name:
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
        lines.append(
            CartLine(
                order_item_id=it.id,
                menu_item_id=it.menu_item_id,
                name=name,
                quantity=it.quantity,
                unit_price=unit_price,
                subtotal=sub,
            )
        )

    if not lines:
        return None

    total = sum(l.subtotal for l in lines)
    return CartSnapshot(order_id=order.id, lines=lines, total=total)
