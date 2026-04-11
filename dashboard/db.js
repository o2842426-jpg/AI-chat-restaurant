// d:\ai-cahtbot\dashboard\db.js
const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "restaurant_bot.db");
const db = new Database(dbPath);

// Safe additive migrations (shared DB with Python bot).
const orderItemsCols = db.prepare("PRAGMA table_info(order_items)").all().map((r) => r.name);
if (!orderItemsCols.includes("unit_price_snapshot")) {
  db.prepare("ALTER TABLE order_items ADD COLUMN unit_price_snapshot REAL").run();
}
if (!orderItemsCols.includes("line_total_snapshot")) {
  db.prepare("ALTER TABLE order_items ADD COLUMN line_total_snapshot REAL").run();
}
if (!orderItemsCols.includes("item_name_snapshot")) {
  db.prepare("ALTER TABLE order_items ADD COLUMN item_name_snapshot TEXT").run();
}
db.prepare(`
  UPDATE order_items
  SET unit_price_snapshot = (
    SELECT mi.price FROM menu_items mi WHERE mi.id = order_items.menu_item_id
  )
  WHERE unit_price_snapshot IS NULL
`).run();
db.prepare(`
  UPDATE order_items
  SET line_total_snapshot = quantity * unit_price_snapshot
  WHERE line_total_snapshot IS NULL AND unit_price_snapshot IS NOT NULL
`).run();
db.prepare(`
  UPDATE order_items
  SET item_name_snapshot = (
    SELECT mi.name FROM menu_items mi WHERE mi.id = order_items.menu_item_id
  )
  WHERE item_name_snapshot IS NULL
`).run();

// Menu operational flags (additive migration).
const menuCols = db.prepare("PRAGMA table_info(menu_items)").all().map((r) => r.name);
if (!menuCols.includes("is_active")) {
  db.prepare("ALTER TABLE menu_items ADD COLUMN is_active INTEGER DEFAULT 1").run();
}
db.prepare(`
  UPDATE menu_items
  SET is_active = 1
  WHERE is_active IS NULL
`).run();

// Restaurant activation flag (additive migration).
const restaurantCols = db.prepare("PRAGMA table_info(restaurants)").all().map((r) => r.name);
if (!restaurantCols.includes("is_active")) {
  db.prepare("ALTER TABLE restaurants ADD COLUMN is_active INTEGER DEFAULT 1").run();
}
db.prepare(`
  UPDATE restaurants
  SET is_active = 1
  WHERE is_active IS NULL
`).run();

const orderCols = db.prepare("PRAGMA table_info(orders)").all().map((r) => r.name);
const orderAdds = [
  ["updated_at", "ALTER TABLE orders ADD COLUMN updated_at TEXT"],
  ["confirmed_at", "ALTER TABLE orders ADD COLUMN confirmed_at TEXT"],
  ["preparing_at", "ALTER TABLE orders ADD COLUMN preparing_at TEXT"],
  ["ready_at", "ALTER TABLE orders ADD COLUMN ready_at TEXT"],
  ["delivered_at", "ALTER TABLE orders ADD COLUMN delivered_at TEXT"],
  ["total_amount", "ALTER TABLE orders ADD COLUMN total_amount REAL"],
];
for (const [name, ddl] of orderAdds) {
  if (!orderCols.includes(name)) {
    db.prepare(ddl).run();
  }
}

db.prepare(`
  UPDATE orders
  SET updated_at = created_at
  WHERE updated_at IS NULL
`).run();

db.prepare(`
  UPDATE orders
  SET total_amount = (
    SELECT COALESCE(SUM(COALESCE(line_total_snapshot, quantity * COALESCE(unit_price_snapshot, 0))), 0)
    FROM order_items oi WHERE oi.order_id = orders.id
  )
  WHERE total_amount IS NULL AND status != 'draft'
`).run();

// Customer fields (additive) for order confirmation.
const usersCols = db.prepare("PRAGMA table_info(users)").all().map((r) => r.name);
if (!usersCols.includes("customer_name")) {
  db.prepare("ALTER TABLE users ADD COLUMN customer_name TEXT").run();
}
if (!usersCols.includes("customer_phone")) {
  db.prepare("ALTER TABLE users ADD COLUMN customer_phone TEXT").run();
}
if (!usersCols.includes("customer_address")) {
  db.prepare("ALTER TABLE users ADD COLUMN customer_address TEXT").run();
}

const orderCols2 = db.prepare("PRAGMA table_info(orders)").all().map((r) => r.name);
const orderAdds2 = [
  ["customer_name_snapshot", "ALTER TABLE orders ADD COLUMN customer_name_snapshot TEXT"],
  ["customer_phone_snapshot", "ALTER TABLE orders ADD COLUMN customer_phone_snapshot TEXT"],
  ["customer_address_snapshot", "ALTER TABLE orders ADD COLUMN customer_address_snapshot TEXT"],
  ["customer_input_step", "ALTER TABLE orders ADD COLUMN customer_input_step TEXT"],
];
for (const [name, ddl] of orderAdds2) {
  if (!orderCols2.includes(name)) db.prepare(ddl).run();
}

const orderCols3 = db.prepare("PRAGMA table_info(orders)").all().map((r) => r.name);
if (!orderCols3.includes("public_order_note")) {
  db.prepare("ALTER TABLE orders ADD COLUMN public_order_note TEXT").run();
}

const orderCols4 = db.prepare("PRAGMA table_info(orders)").all().map((r) => r.name);
if (!orderCols4.includes("order_type")) {
  db.prepare("ALTER TABLE orders ADD COLUMN order_type TEXT").run();
}
const orderCols5 = db.prepare("PRAGMA table_info(orders)").all().map((r) => r.name);
if (!orderCols5.includes("table_number")) {
  db.prepare("ALTER TABLE orders ADD COLUMN table_number TEXT").run();
}

// Placeholder user for web/QR orders (not a Telegram account). Same id as dashboard public.routes.js.
db.prepare(
  `
  INSERT OR IGNORE INTO users (id, username, first_name, restaurant_id)
  VALUES (-1, 'web', 'Web orders', NULL)
`
).run();

// Additive audit trail for order status changes.
db.prepare(`
  CREATE TABLE IF NOT EXISTS order_status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    restaurant_id INTEGER NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    changed_at TEXT,
    changed_by_role TEXT,
    changed_by_user_id INTEGER
  )
`).run();

module.exports = db;
