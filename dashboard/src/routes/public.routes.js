const express = require("express");
const { sendTelegramMessage, isTelegramKitchenDisabled } = require("../services/telegramKitchen");

/** Same sentinel as dashboard/db.js migration — not a Telegram user id. */
const WEB_ORDER_USER_ID = -1;

const MIN_PUBLIC_QTY = 1;
const MAX_PUBLIC_QTY = 5;

function nowSqlite() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

/** Telegram chat id (group is usually negative). Returns null if missing or invalid. */
function parseTelegramChatId(raw) {
  if (raw == null || raw === "") return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return n;
}

function normalizePublicOrderType(raw) {
  const s = String(raw == null ? "" : raw)
    .trim()
    .toLowerCase();
  if (s === "dine_in") return "dine_in";
  if (s === "delivery") return "delivery";
  return null;
}

function buildKitchenText({
  orderId,
  orderType,
  tableNumber,
  name,
  phone,
  address,
  itemLines,
  total,
  note,
}) {
  const header = [`Order #${orderId}`];
  let metaLines;
  if (orderType === "dine_in") {
    metaLines = ["🍽️ داخل المطعم", `طاولة رقم: ${tableNumber || "?"}`, ""];
  } else {
    metaLines = [
      "🚚 توصيل",
      "بيانات العميل:",
      `- الاسم: ${name || "—"}`,
      `- الهاتف: ${phone || "—"}`,
      `- العنوان: ${address || "—"}`,
      "",
    ];
  }
  if (note && String(note).trim()) {
    metaLines.push(`- ملاحظة: ${String(note).trim()}`, "");
  }
  const bodyLines = itemLines.map((l) => `${l.name} x${l.qty}`);
  return [...header, ...metaLines, ...bodyLines, "", `Total: ${total.toFixed(2)}`].join("\n");
}

function createPublicRouter({ db, telegramBotToken }) {
  const router = express.Router();

  router.get("/menu/:restaurantId", (req, res) => {
    try {
      const restaurantId = Number(req.params.restaurantId);
      if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
        return res.status(400).json({ error: "invalid restaurant id" });
      }

      const restaurant = db
        .prepare(`SELECT id, is_active FROM restaurants WHERE id = ?`)
        .get(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "restaurant not found" });
      }
      if (Number(restaurant.is_active) !== 1) {
        return res.status(403).json({ error: "restaurant is not accepting orders" });
      }

      const rows = db
        .prepare(
          `
          SELECT id, name, category, price , is_active
          FROM menu_items
          WHERE restaurant_id = ?
          ORDER BY category ASC, name ASC
        `
        )
        .all(restaurantId);

      const categories = {};
      for (const r of rows) {
        const cat = r.category || "Other";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push({
          id: r.id,
          name: r.name,
          price: Number(r.price),
          is_active: Number(r.is_active) === 0 ? 0 : 1,
        });
      }

      res.json({ restaurant_id: restaurantId, categories });
    } catch (err) {
      console.error("[public/menu]", err);
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/orders/:id/status", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "invalid order id" });
      }

      const row = db
        .prepare(
          `
          SELECT id, status, updated_at
          FROM orders
          WHERE id = ?
        `
        )
        .get(id);

      if (!row) {
        return res.status(404).json({ error: "order not found" });
      }

      const status = String(row.status || "").trim().toLowerCase();
      return res.json({
        order_id: row.id,
        status,
        updated_at: row.updated_at ?? null,
      });
    } catch (err) {
      console.error("[public/orders/:id/status]", err);
      return res.status(500).json({ error: err.message });
    }
  });

  router.post("/orders", (req, res) => {
    try {
      const body = req.body || {};
      const restaurantId = Number(body.restaurant_id);
      let orderType = normalizePublicOrderType(body.order_type);
      if (orderType == null) {
        orderType = "delivery";
      }

      const customerName = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
      const customerPhone = typeof body.customer_phone === "string" ? body.customer_phone.trim() : "";
      const customerAddress =
        typeof body.customer_address === "string" ? body.customer_address.trim() : "";
      const tableNumberRaw = body.table_number;
      const tableNumber =
        tableNumberRaw == null || tableNumberRaw === ""
          ? ""
          : typeof tableNumberRaw === "string"
            ? tableNumberRaw.trim()
            : String(tableNumberRaw).trim();

      const noteRaw = body.note;
      const note =
        noteRaw == null || noteRaw === ""
          ? null
          : typeof noteRaw === "string"
            ? noteRaw.trim() || null
            : String(noteRaw).trim() || null;

      if (!Number.isFinite(restaurantId) || restaurantId <= 0) {
        return res.status(400).json({ error: "invalid restaurant_id" });
      }

      if (orderType === "dine_in") {
        if (!tableNumber) {
          return res.status(400).json({ error: "table_number is required for dine_in orders" });
        }
      } else {
        if (!customerName || !customerPhone || !customerAddress) {
          return res.status(400).json({
            error: "customer_name, customer_phone, and customer_address are required for delivery",
          });
        }
      }

      const itemsIn = Array.isArray(body.items) ? body.items : null;
      if (!itemsIn || itemsIn.length === 0) {
        return res.status(400).json({ error: "items must be a non-empty array" });
      }

      const restaurant = db
        .prepare(`SELECT id, is_active, telegram_group_id FROM restaurants WHERE id = ?`)
        .get(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "restaurant not found" });
      }
      if (Number(restaurant.is_active) !== 1) {
        return res.status(403).json({ error: "restaurant is not accepting orders" });
      }

      const merged = new Map();
      for (const raw of itemsIn) {
        const menuItemId = Number(raw?.menu_item_id);
        let qty = Number(raw?.quantity);
        if (!Number.isFinite(menuItemId) || menuItemId <= 0) {
          return res.status(400).json({ error: "invalid menu_item_id in items" });
        }
        if (!Number.isFinite(qty) || qty < MIN_PUBLIC_QTY || qty > MAX_PUBLIC_QTY) {
          return res.status(400).json({ error: `quantity must be between ${MIN_PUBLIC_QTY} and ${MAX_PUBLIC_QTY}` });
        }
        const next = (merged.get(menuItemId) || 0) + Math.floor(qty);
        if (next > MAX_PUBLIC_QTY) {
          return res.status(400).json({ error: `max total quantity per item is ${MAX_PUBLIC_QTY}` });
        }
        merged.set(menuItemId, next);
      }

      const menuStmt = db.prepare(
        `
        SELECT id, name, price
        FROM menu_items
        WHERE id = ?
          AND restaurant_id = ?
          AND COALESCE(is_active, 1) = 1
      `
      );

      const resolvedLines = [];
      for (const [menuItemId, quantity] of merged.entries()) {
        const mi = menuStmt.get(menuItemId, restaurantId);
        if (!mi) {
          return res.status(400).json({ error: "inactive or unknown menu item", menu_item_id: menuItemId });
        }
        const unit = Number(mi.price);
        const lineTotal = quantity * unit;
        resolvedLines.push({
          menu_item_id: mi.id,
          name: mi.name,
          quantity,
          unit_price_snapshot: unit,
          line_total_snapshot: lineTotal,
        });
      }

      const now = nowSqlite();

      let orderId;
      let totalAmount;
      let kitchenItemLines;

      const nameSnap = orderType === "dine_in" ? null : customerName || null;
      const phoneSnap = orderType === "dine_in" ? null : customerPhone || null;
      const addrSnap = orderType === "dine_in" ? null : customerAddress || null;
      const tableSnap = orderType === "dine_in" ? tableNumber : null;

      const tx = db.transaction(() => {
        const info = db
          .prepare(
            `
            INSERT INTO orders (
              restaurant_id, user_id, status, created_at, updated_at,
              customer_name_snapshot, customer_phone_snapshot, customer_address_snapshot,
              customer_input_step, public_order_note, order_type, table_number
            )
            VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, NULL, ?, ?, ?)
          `
          )
          .run(
            restaurantId,
            WEB_ORDER_USER_ID,
            now,
            now,
            nameSnap,
            phoneSnap,
            addrSnap,
            note,
            orderType,
            tableSnap
          );

        orderId = Number(info.lastInsertRowid);

        const insertItem = db.prepare(
          `
          INSERT INTO order_items
            (order_id, menu_item_id, quantity, item_name_snapshot, unit_price_snapshot, line_total_snapshot)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        );

        for (const line of resolvedLines) {
          insertItem.run(
            orderId,
            line.menu_item_id,
            line.quantity,
            line.name,
            line.unit_price_snapshot,
            line.line_total_snapshot
          );
        }

        const sumRow = db
          .prepare(
            `
            SELECT COALESCE(SUM(line_total_snapshot), 0) AS t
            FROM order_items
            WHERE order_id = ?
          `
          )
          .get(orderId);
        totalAmount = Number(sumRow.t);

        db.prepare(
          `
          UPDATE orders
          SET status = 'confirmed',
              confirmed_at = ?,
              updated_at = ?,
              total_amount = ?,
              customer_input_step = NULL
          WHERE id = ? AND restaurant_id = ?
        `
        ).run(now, now, totalAmount, orderId, restaurantId);

        db.prepare(
          `
          INSERT INTO order_status_history
            (order_id, restaurant_id, from_status, to_status, changed_at, changed_by_role, changed_by_user_id)
          VALUES (?, ?, 'draft', 'confirmed', ?, 'web_public', ?)
        `
        ).run(orderId, restaurantId, now, WEB_ORDER_USER_ID);

        kitchenItemLines = resolvedLines.map((l) => ({ name: l.name, qty: l.quantity }));
      });

      tx();

      const kitchenText = buildKitchenText({
        orderId,
        orderType,
        tableNumber: tableSnap,
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        itemLines: kitchenItemLines,
        total: totalAmount,
        note,
      });

      const fromDb = parseTelegramChatId(restaurant.telegram_group_id);
      const fromEnv = parseTelegramChatId(process.env.KITCHEN_GROUP_ID);
      const chatId = fromDb != null ? fromDb : fromEnv;
      const chatSource =
        fromDb != null ? "restaurants.telegram_group_id (DB)" : fromEnv != null ? "KITCHEN_GROUP_ID (.env)" : "none";

      const token = telegramBotToken || process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
      if (!isTelegramKitchenDisabled()) {
        if (chatId != null && token) {
          console.log(`[public/orders] kitchen notify → chat_id=${chatId} (source: ${chatSource})`);
        } else {
          console.warn(
            `[public/orders] kitchen notify skipped: token=${Boolean(token)} chat_id=${chatId === null ? "missing" : chatId} (DB had ${restaurant.telegram_group_id ?? "null"}, env KITCHEN_GROUP_ID=${process.env.KITCHEN_GROUP_ID ?? "unset"})`
          );
        }
      }
      void sendTelegramMessage(token, chatId, kitchenText);

      res.status(201).json({
        ok: true,
        order_id: orderId,
        status: "confirmed",
        total_amount: totalAmount,
      });
    } catch (err) {
      console.error("[public/orders]", err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createPublicRouter, WEB_ORDER_USER_ID };
