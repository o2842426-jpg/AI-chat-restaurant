from db import SessionLocal, MenuItem, init_db
from models import ensure_default_restaurant
from config import DEFAULT_RESTAURANT_ID


def seed_menu():
    init_db()  # ينشئ الجداول (restaurants, users, menu_items, orders, order_items) إن لم تكن موجودة
    db = SessionLocal()
    try:
        ensure_default_restaurant(db)

        items = [
            ("Classic Burger", "Burgers", 20.0),
            ("Cheese Burger", "Burgers", 22.0),
            ("Margherita Pizza", "Pizza", 30.0),
            ("Pepperoni Pizza", "Pizza", 35.0),
            ("Cola", "Drinks", 5.0),
            ("Orange Juice", "Drinks", 8.0),
            ("Fries", "Extras", 10.0),
        ]

        for name, category, price in items:
            exists = (
                db.query(MenuItem)
                .filter_by(restaurant_id=DEFAULT_RESTAURANT_ID, name=name)
                .first()
            )
            if not exists:
                db.add(
                    MenuItem(
                        restaurant_id=DEFAULT_RESTAURANT_ID,
                        name=name,
                        category=category,
                        price=price,
                    )
                )

        db.commit()
        print("Menu seeded successfully")
    finally:
        db.close()


if __name__ == "__main__":
    seed_menu()

