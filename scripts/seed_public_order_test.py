"""One-off seed for testing public menu/order API. Safe: INSERT OR IGNORE restaurant 1."""
import sqlite3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
db_path = root / "restaurant_bot.db"
conn = sqlite3.connect(db_path)
conn.execute(
    "INSERT OR IGNORE INTO restaurants (id, name, is_active) VALUES (1, 'Test Restaurant', 1)"
)
n = conn.execute("SELECT COUNT(*) FROM menu_items WHERE restaurant_id=1").fetchone()[0]
if n == 0:
    conn.execute(
        "INSERT INTO menu_items (restaurant_id, name, category, price, is_active) VALUES (1, 'Burger', 'Main', 12.5, 1)"
    )
    conn.execute(
        "INSERT INTO menu_items (restaurant_id, name, category, price, is_active) VALUES (1, 'Water', 'Drinks', 2.0, 1)"
    )
conn.commit()
print("OK:", db_path)
print("restaurants:", conn.execute("SELECT id, name, is_active FROM restaurants WHERE id=1").fetchall())
print("menu:", conn.execute("SELECT id, name, category, price FROM menu_items WHERE restaurant_id=1").fetchall())
conn.close()
