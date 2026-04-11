from datetime import datetime
from pathlib import Path
import shutil

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, create_engine
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from sqlalchemy import text


def _resolve_db_paths() -> tuple[Path, Path]:
    """Return (root_db_path, legacy_bot_local_path)."""
    bot_dir = Path(__file__).resolve().parent
    root = bot_dir.parent
    return root / "restaurant_bot.db", bot_dir / "restaurant_bot.db"


def _migrate_legacy_local_db(root_db_path: Path, bot_local_path: Path) -> None:
    """
    If an old DB exists only inside bot/, copy it once to repo root.
    Keeps backward compatibility with older local setups.
    """
    if not root_db_path.exists() and bot_local_path.exists():
        shutil.copy2(bot_local_path, root_db_path)


_DB_PATH, _BOT_LOCAL = _resolve_db_paths()
_migrate_legacy_local_db(_DB_PATH, _BOT_LOCAL)

engine = create_engine(f"sqlite:///{_DB_PATH.as_posix()}", echo=False)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class Restaurant(Base):
    __tablename__ = "restaurants"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    telegram_group_id = Column(Integer, nullable=True)
    is_active = Column(Integer, default=1, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)  # Telegram user id
    username = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    # Legacy only: restaurant ownership/scoping must be enforced via orders.restaurant_id.
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))
    # Customer defaults (optional): used as a convenience before confirmation.
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(String, nullable=True)


class MenuItem(Base):
    __tablename__ = "menu_items"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # Burgers / Pizza / Drinks / Extras
    price = Column(Float, nullable=False)
    # Operational flag (additive): when 0, item is hidden from menu selections.
    # Snapshots on orders remain unchanged for history.
    is_active = Column(Integer, default=1, nullable=True)


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String, default="draft")  # draft / confirmed / preparing / ready / delivered
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)
    preparing_at = Column(DateTime, nullable=True)
    ready_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    total_amount = Column(Float, nullable=True)
    # Customer snapshots (collected during draft, finalized at confirmation).
    customer_name_snapshot = Column(String, nullable=True)
    customer_phone_snapshot = Column(String, nullable=True)
    customer_address_snapshot = Column(String, nullable=True)
    # Customer input step during draft: name | phone | address | review | NULL
    customer_input_step = Column(String, nullable=True)
    # Optional note from public web/QR ordering (additive column).
    public_order_note = Column(String, nullable=True)
    # dine_in | delivery; NULL = legacy (treated as delivery for validation).
    order_type = Column(String, nullable=True)
    table_number = Column(String, nullable=True)

    items = relationship("OrderItem", back_populates="order")


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    quantity = Column(Integer, default=1)
    item_name_snapshot = Column(String, nullable=True)
    unit_price_snapshot = Column(Float, nullable=True)
    line_total_snapshot = Column(Float, nullable=True)

    order = relationship("Order", back_populates="items")


class OrderStatusHistory(Base):
    """
    Audit trail for order state transitions.

    This is intentionally additive (new table only) to avoid breaking existing flows.
    """

    __tablename__ = "order_status_history"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), index=True)
    from_status = Column(String, nullable=False)
    to_status = Column(String, nullable=False)
    changed_at = Column(DateTime, default=datetime.utcnow)
    changed_by_role = Column(String, nullable=True)
    changed_by_user_id = Column(Integer, nullable=True)


def init_db():
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        oi_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(order_items)")).fetchall()}
        if "unit_price_snapshot" not in oi_cols:
            conn.execute(text("ALTER TABLE order_items ADD COLUMN unit_price_snapshot REAL"))
        if "line_total_snapshot" not in oi_cols:
            conn.execute(text("ALTER TABLE order_items ADD COLUMN line_total_snapshot REAL"))
        if "item_name_snapshot" not in oi_cols:
            conn.execute(text("ALTER TABLE order_items ADD COLUMN item_name_snapshot VARCHAR"))

        conn.execute(
            text(
                """
                UPDATE order_items
                SET unit_price_snapshot = (
                    SELECT mi.price FROM menu_items mi WHERE mi.id = order_items.menu_item_id
                )
                WHERE unit_price_snapshot IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE order_items
                SET line_total_snapshot = quantity * unit_price_snapshot
                WHERE line_total_snapshot IS NULL AND unit_price_snapshot IS NOT NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE order_items
                SET item_name_snapshot = (
                    SELECT mi.name FROM menu_items mi WHERE mi.id = order_items.menu_item_id
                )
                WHERE item_name_snapshot IS NULL
                """
            )
        )

        # Menu operational flags (additive migration).
        mi_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(menu_items)")).fetchall()}
        if "is_active" not in mi_cols:
            conn.execute(text("ALTER TABLE menu_items ADD COLUMN is_active INTEGER DEFAULT 1"))
        conn.execute(
            text(
                """
                UPDATE menu_items
                SET is_active = 1
                WHERE is_active IS NULL
                """
            )
        )

        # Restaurant activation flag (additive migration).
        rest_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(restaurants)")).fetchall()}
        if "is_active" not in rest_cols:
            conn.execute(text("ALTER TABLE restaurants ADD COLUMN is_active INTEGER DEFAULT 1"))
        conn.execute(
            text(
                """
                UPDATE restaurants
                SET is_active = 1
                WHERE is_active IS NULL
                """
            )
        )

        ord_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(orders)")).fetchall()}
        for col, ddl in (
            ("updated_at", "ALTER TABLE orders ADD COLUMN updated_at DATETIME"),
            ("confirmed_at", "ALTER TABLE orders ADD COLUMN confirmed_at DATETIME"),
            ("preparing_at", "ALTER TABLE orders ADD COLUMN preparing_at DATETIME"),
            ("ready_at", "ALTER TABLE orders ADD COLUMN ready_at DATETIME"),
            ("delivered_at", "ALTER TABLE orders ADD COLUMN delivered_at DATETIME"),
            ("total_amount", "ALTER TABLE orders ADD COLUMN total_amount REAL"),
        ):
            if col not in ord_cols:
                conn.execute(text(ddl))

        conn.execute(
            text(
                """
                UPDATE orders
                SET updated_at = created_at
                WHERE updated_at IS NULL
                """
            )
        )
        conn.execute(
            text(
                """
                UPDATE orders
                SET total_amount = (
                    SELECT COALESCE(SUM(COALESCE(line_total_snapshot, quantity * COALESCE(unit_price_snapshot, 0))), 0)
                    FROM order_items oi WHERE oi.order_id = orders.id
                )
                WHERE total_amount IS NULL AND status != 'draft'
                """
            )
        )

        # Customer fields (additive migration).
        users_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()}
        for col, ddl in (
            ("customer_name", "ALTER TABLE users ADD COLUMN customer_name VARCHAR"),
            ("customer_phone", "ALTER TABLE users ADD COLUMN customer_phone VARCHAR"),
            ("customer_address", "ALTER TABLE users ADD COLUMN customer_address VARCHAR"),
        ):
            if col not in users_cols:
                conn.execute(text(ddl))

        ord_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(orders)")).fetchall()}
        for col, ddl in (
            ("customer_name_snapshot", "ALTER TABLE orders ADD COLUMN customer_name_snapshot VARCHAR"),
            ("customer_phone_snapshot", "ALTER TABLE orders ADD COLUMN customer_phone_snapshot VARCHAR"),
            ("customer_address_snapshot", "ALTER TABLE orders ADD COLUMN customer_address_snapshot VARCHAR"),
            ("customer_input_step", "ALTER TABLE orders ADD COLUMN customer_input_step VARCHAR"),
            ("public_order_note", "ALTER TABLE orders ADD COLUMN public_order_note VARCHAR"),
            ("order_type", "ALTER TABLE orders ADD COLUMN order_type VARCHAR"),
            ("table_number", "ALTER TABLE orders ADD COLUMN table_number VARCHAR"),
        ):
            if col not in ord_cols:
                conn.execute(text(ddl))

        conn.execute(
            text(
                """
                INSERT OR IGNORE INTO users (id, username, first_name, restaurant_id)
                VALUES (-1, 'web', 'Web orders', NULL)
                """
            )
        )