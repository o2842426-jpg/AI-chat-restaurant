from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session
from db import SessionLocal, Restaurant, User, MenuItem, Order, OrderItem
from config import BOT_RESTAURANT_ID


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_default_restaurant(db: Session, restaurant_id: Optional[int] = None):
    rid = BOT_RESTAURANT_ID if restaurant_id is None else restaurant_id
    restaurant = db.query(Restaurant).filter_by(id=rid).first()
    if not restaurant:
        restaurant = Restaurant(id=rid, name="My Restaurant")
        db.add(restaurant)
        db.commit()
    return restaurant


def get_or_create_user(db: Session, tg_user):
    user = db.query(User).filter_by(id=tg_user.id).first()
    if not user:
        user = User(
            id=tg_user.id,
            username=tg_user.username,
            first_name=tg_user.first_name,
            # Legacy compatibility: set once at signup, but never use it for scoping.
            restaurant_id=BOT_RESTAURANT_ID,
        )
        db.add(user)
        db.commit()
    return user


def get_or_create_draft_order(db: Session, user_id: int, restaurant_id: int):
    order = (
        db.query(Order)
        .filter_by(user_id=user_id, status="draft", restaurant_id=restaurant_id)
        .first()
    )
    if not order:
        now = datetime.utcnow()
        order = Order(
            restaurant_id=restaurant_id,
            user_id=user_id,
            status="draft",
            updated_at=now,
        )
        db.add(order)
        db.commit()
        db.refresh(order)
    return order


def add_item_to_order(db: Session, order_id: int, menu_item_id: int, quantity: int = 1):
    # Domain rule: quantity must be a positive integer.
    try:
        quantity = int(quantity)
    except Exception:
        quantity = 1
    if quantity < 1:
        quantity = 1
    order = db.query(Order).filter_by(id=order_id).first()
    if not order or order.status != "draft":
        return

    menu_row = (
        db.query(MenuItem)
        .filter(
            MenuItem.id == menu_item_id,
            MenuItem.restaurant_id == order.restaurant_id,
            # Domain rule: do not allow inactive menu items into draft orders.
            ((MenuItem.is_active == 1) | (MenuItem.is_active.is_(None))),
        )
        .first()
    )
    if not menu_row:
        return

    item = (
        db.query(OrderItem)
        .filter_by(order_id=order_id, menu_item_id=menu_item_id)
        .first()
    )
    if item:
        item.quantity += quantity
        if item.unit_price_snapshot is None:
            item.unit_price_snapshot = float(menu_row.price)
        if item.item_name_snapshot is None:
            item.item_name_snapshot = menu_row.name
        item.line_total_snapshot = float(item.quantity) * float(item.unit_price_snapshot)
    else:
        unit_price = float(menu_row.price)
        item = OrderItem(
            order_id=order_id,
            menu_item_id=menu_item_id,
            quantity=quantity,
            item_name_snapshot=menu_row.name,
            unit_price_snapshot=unit_price,
            line_total_snapshot=float(quantity) * unit_price,
        )
        db.add(item)
    order.updated_at = datetime.utcnow()
    db.commit()


def remove_item_from_order(db: Session, order_item_id: int, user_id: int, restaurant_id: int):
    item = db.query(OrderItem).filter_by(id=order_item_id).first()
    if not item:
        return
    order = db.query(Order).filter_by(id=item.order_id).first()
    if not order or order.status != "draft":
        return
    if order.user_id != user_id or order.restaurant_id != restaurant_id:
        return
    db.delete(item)
    order.updated_at = datetime.utcnow()
    db.commit()


def get_menu_by_category(db: Session, category: str, restaurant_id: int):
    return (
        db.query(MenuItem)
        .filter(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.category == category,
            # Show only active items; treat NULL (old rows) as active.
            ((MenuItem.is_active == 1) | (MenuItem.is_active.is_(None))),
        )
        .all()
    )


def get_menu_item_by_name(db: Session, restaurant_id: int, name: str):
    """Find a menu row by exact name (used for static upsell targets)."""
    return (
        db.query(MenuItem)
        .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.name == name)
        .filter(((MenuItem.is_active == 1) | (MenuItem.is_active.is_(None))))
        .first()
    )


def get_menu_by_id(db: Session, menu_item_id: int):
    return (
        db.query(MenuItem)
        .filter(MenuItem.id == menu_item_id)
        .filter(((MenuItem.is_active == 1) | (MenuItem.is_active.is_(None))))
        .first()
    )


def get_last_confirmed_order(db: Session, user_id: int, restaurant_id: int):
    """Return last non-draft order (legacy name kept for compatibility)."""
    return (
        db.query(Order)
        .filter_by(user_id=user_id, restaurant_id=restaurant_id)
        .filter(Order.status != "draft")
        .order_by(Order.id.desc())
        .first()
    )
