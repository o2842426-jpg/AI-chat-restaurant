"""
المستوى 5 — اقتراح upsell ديناميكي من بيانات الطلبات (confirmed فقط).

المنطق:
- يُفعَّل فقط عند وجود حد أدنى من الطلبات المؤكدة للمطعم (إلا يُرجَع None → fallback ثابت).
- يجمع درجات من: اشتِراك مع المنتج المُضاف (co-occurrence في نفس الطلب)،
  شعبية عامة، وتاريخ العميل على نفس المطعم.
- يستبعد أي menu_item_id موجود أصلاً في السلة الحالية (المسودة).
"""
from __future__ import annotations

import math
from typing import Optional, Tuple, Set, Dict, List

from sqlalchemy import text
from sqlalchemy.orm import Session

from db import MenuItem, OrderItem

# أقل عدد طلبات مؤكدة للمطعم قبل استخدام الاقتراح الديناميكي
MIN_CONFIRMED_ORDERS_FOR_DYNAMIC = 5

# أوزان التسجيل (يمكن ضبطها لاحقاً)
WEIGHT_CO_OCCURRENCE = 3.0
WEIGHT_POPULARITY = 1.0
WEIGHT_USER_HISTORY = 2.0


def _cart_menu_item_ids(db: Session, draft_order_id: int) -> Set[int]:
    rows = (
        db.query(OrderItem.menu_item_id)
        .filter(OrderItem.order_id == draft_order_id)
        .all()
    )
    return {r[0] for r in rows}


def _count_confirmed_orders(db: Session, restaurant_id: int) -> int:
    from db import Order

    return (
        db.query(Order)
        .filter(Order.restaurant_id == restaurant_id, Order.status == "confirmed")
        .count()
    )


def _co_occurrence_weights(
    db: Session, restaurant_id: int, anchor_menu_item_id: int
) -> Dict[int, float]:
    """
    لكل منتج ظهر في نفس طلب مؤكد مع anchor_menu_item_id: مجموع الكميات (وزن اشتِراك).
    """
    q = text(
        """
        SELECT oi2.menu_item_id, SUM(oi2.quantity) AS w
        FROM order_items oi1
        JOIN orders o ON o.id = oi1.order_id
            AND o.status = 'confirmed'
            AND o.restaurant_id = :rid
        JOIN order_items oi2 ON oi2.order_id = o.id
            AND oi2.menu_item_id != oi1.menu_item_id
        WHERE oi1.menu_item_id = :mid
        GROUP BY oi2.menu_item_id
        """
    )
    rows = db.execute(q, {"rid": restaurant_id, "mid": anchor_menu_item_id}).fetchall()
    return {int(r[0]): float(r[1] or 0) for r in rows}


def _popularity_by_item(db: Session, restaurant_id: int) -> Dict[int, float]:
    q = text(
        """
        SELECT oi.menu_item_id, SUM(oi.quantity) AS pop
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
            AND o.status = 'confirmed'
            AND o.restaurant_id = :rid
        GROUP BY oi.menu_item_id
        """
    )
    rows = db.execute(q, {"rid": restaurant_id}).fetchall()
    return {int(r[0]): float(r[1] or 0) for r in rows}


def _user_item_weights(
    db: Session, restaurant_id: int, user_id: int
) -> Dict[int, float]:
    q = text(
        """
        SELECT oi.menu_item_id, SUM(oi.quantity) AS uq
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
            AND o.status = 'confirmed'
            AND o.restaurant_id = :rid
            AND o.user_id = :uid
        GROUP BY oi.menu_item_id
        """
    )
    rows = db.execute(q, {"rid": restaurant_id, "uid": user_id}).fetchall()
    return {int(r[0]): float(r[1] or 0) for r in rows}


def _score_candidate(
    mid: int,
    co: float,
    pop: float,
    uh: float,
) -> float:
    return (
        WEIGHT_CO_OCCURRENCE * math.log1p(co)
        + WEIGHT_POPULARITY * math.log1p(pop)
        + WEIGHT_USER_HISTORY * math.log1p(uh)
    )


def recommend_upsell_dynamic(
    db: Session,
    restaurant_id: int,
    user_id: int,
    added_item: MenuItem,
    draft_order_id: int,
) -> Optional[Tuple[MenuItem, str]]:
    """
    يختار منتجاً واحداً للاقتراح مع نص عربي جاهز للعرض.

    يعيد None إذا:
    - بيانات غير كافية (أقل من MIN_CONFIRMED_ORDERS_FOR_DYNAMIC)، أو
    - لا يوجد مرشح صالح بعد الاستبعاد (السلة / نفس المنتج)، أو
    - لا يوجد اشتِراك مع المنتج المُضاف في الطلبات المؤكدة.
    """
    if _count_confirmed_orders(db, restaurant_id) < MIN_CONFIRMED_ORDERS_FOR_DYNAMIC:
        return None

    cart_ids = _cart_menu_item_ids(db, draft_order_id)
    co_map = _co_occurrence_weights(db, restaurant_id, added_item.id)
    if not co_map:
        return None

    pop_map = _popularity_by_item(db, restaurant_id)
    user_map = _user_item_weights(db, restaurant_id, user_id)

    # مرشحون: لهم اشتِراك مع المنتج المُضاف، وليسوا في السلة، وليسوا نفس المنتج
    candidate_ids: List[int] = []
    for mid, co_w in co_map.items():
        if mid == added_item.id:
            continue
        if mid in cart_ids:
            continue
        candidate_ids.append(mid)

    if not candidate_ids:
        return None

    best_mid: Optional[int] = None
    best_score = -1.0

    for mid in candidate_ids:
        co = co_map.get(mid, 0.0)
        pop = pop_map.get(mid, 0.0)
        uh = user_map.get(mid, 0.0)
        s = _score_candidate(mid, co, pop, uh)
        if s > best_score:
            best_score = s
            best_mid = mid

    if best_mid is None or best_score <= 0:
        return None

    suggested = (
        db.query(MenuItem)
        .filter(MenuItem.id == best_mid, MenuItem.restaurant_id == restaurant_id)
        .filter(((MenuItem.is_active == 1) | (MenuItem.is_active.is_(None))))
        .first()
    )
    if not suggested:
        return None

    msg = (
        f"📊 بناءً على طلبات سابقة، «{suggested.name}» يُطلب غالباً مع «{added_item.name}».\n"
        f"السعر: {suggested.price:.2f}\n\n"
        f"هل تريد إضافته؟"
    )
    return (suggested, msg)


def recommend_upsell(
    db: Session,
    restaurant_id: int,
    user_id: int,
    added_item: MenuItem,
    draft_order_id: int,
) -> Optional[Tuple[MenuItem, str]]:
    """
    واجهة موحّدة: حالياً نفس recommend_upsell_dynamic (للتوسعة لاحقاً بمزج قواعد أخرى).
    """
    return recommend_upsell_dynamic(db, restaurant_id, user_id, added_item, draft_order_id)
