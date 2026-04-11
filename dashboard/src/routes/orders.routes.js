const express = require("express");
const { normalizeStatus, canTransition } = require("../orders/orderTransitions");

/** Same sentinel as public web orders (`dashboard/src/routes/public.routes.js`). */
const WEB_ORDER_USER_ID = -1;

function nowSqlite() {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function createOrdersRouter({ db }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    try {
      const statusRaw = req.query.status;
      const status = typeof statusRaw === "string" ? statusRaw.toLowerCase() : statusRaw;
      const allowed = ["confirmed", "preparing", "ready", "delivered"];
      const limitRaw = Number(req.query.limit);
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(500, Math.floor(limitRaw)) : 200;
      let orders;

      if (allowed.includes(status)) {
        orders = db
          .prepare(
            `
      SELECT id, user_id, status, created_at, updated_at, total_amount, confirmed_at,
             customer_name_snapshot, customer_phone_snapshot, customer_address_snapshot,
             public_order_note
      FROM orders
      WHERE restaurant_id = ? AND status = ?
      ORDER BY id DESC
      LIMIT ?
    `
          )
          .all(req.restaurantId, status, limit);
      } else {
        orders = db
          .prepare(
            `
        SELECT id, user_id, status, created_at, updated_at, total_amount, confirmed_at,
               customer_name_snapshot, customer_phone_snapshot, customer_address_snapshot,
               public_order_note
        FROM orders
        WHERE restaurant_id = ? AND LOWER(COALESCE(status,'')) != 'draft'
        ORDER BY id DESC
        LIMIT ?
      `
          )
          .all(req.restaurantId, limit);
      }

      const orderIds = orders.map((o) => o.id);
      const itemsByOrderId = new Map();
      if (orderIds.length > 0) {
        const placeholders = orderIds.map(() => "?").join(",");
        const items = db
          .prepare(
            `
      SELECT oi.id, oi.quantity,
             COALESCE(oi.item_name_snapshot, mi.name) AS name,
             COALESCE(oi.unit_price_snapshot, mi.price) AS price,
             oi.order_id
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.id ASC
    `
          )
          .all(...orderIds);

        for (const item of items) {
          const list = itemsByOrderId.get(item.order_id) || [];
          list.push({
            id: item.id,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
          });
          itemsByOrderId.set(item.order_id, list);
        }
      }

      const result = orders.map((order) => {
        const plain = JSON.parse(JSON.stringify(order));
        const items = itemsByOrderId.get(plain.id) || [];
        const uid = Number(plain.user_id);
        const fromWeb = uid === WEB_ORDER_USER_ID;
        return {
          id: plain.id,
          user_id: plain.user_id,
          status: plain.status,
          created_at: plain.created_at,
          updated_at: plain.updated_at,
          total_amount: plain.total_amount,
          confirmed_at: plain.confirmed_at,
          customer_name_snapshot: plain.customer_name_snapshot ?? null,
          customer_phone_snapshot: plain.customer_phone_snapshot ?? null,
          customer_address_snapshot: plain.customer_address_snapshot ?? null,
          public_order_note: plain.public_order_note ?? null,
          /** Helps staff see web vs Telegram at a glance. */
          order_source: fromWeb ? "web" : "telegram",
          items,
        };
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch("/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const statusRaw = req.body?.status;
      const nextStatus = normalizeStatus(statusRaw);
      const kitchenStatuses = ["confirmed", "preparing", "ready", "delivered"];

      if (!nextStatus || !kitchenStatuses.includes(nextStatus)) {
        return res.status(400).json({ error: "invalid status" });
      }

      const row = db
        .prepare(
          `
      SELECT id, status FROM orders WHERE id = ? AND restaurant_id = ?
    `
        )
        .get(id, req.restaurantId);

      if (!row) {
        return res.status(404).json({ error: "order not found" });
      }

      const current = normalizeStatus(row.status);
      if (current === "draft") {
        return res.status(403).json({ error: "draft orders are finalized via Telegram" });
      }

      if (!canTransition(current, nextStatus)) {
        return res.status(400).json({ error: "invalid status transition" });
      }

      const now = nowSqlite();
      const updates = ["status = ?", "updated_at = ?"];
      const values = [nextStatus, now];

      if (nextStatus === "preparing") {
        updates.push("preparing_at = ?");
        values.push(now);
      }
      if (nextStatus === "ready") {
        updates.push("ready_at = ?");
        values.push(now);
      }
      if (nextStatus === "delivered") {
        updates.push("delivered_at = ?");
        values.push(now);
      }
      if (nextStatus === "confirmed") {
        updates.push("confirmed_at = ?");
        values.push(now);
      }

      values.push(id, req.restaurantId);

      const updateStmt = db.prepare(
        `
      UPDATE orders
      SET ${updates.join(", ")}
      WHERE id = ? AND restaurant_id = ?
    `
      );

      const insertHistoryStmt = db.prepare(
        `
      INSERT INTO order_status_history
        (order_id, restaurant_id, from_status, to_status, changed_at, changed_by_role, changed_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      );

      const tx = db.transaction(() => {
        const result = updateStmt.run(...values);
        if (result.changes === 0) return result;
        insertHistoryStmt.run(
          id,
          req.restaurantId,
          current,
          nextStatus,
          now,
          "restaurant_dashboard",
          null
        );
        return result;
      });

      const result = tx();

      if (result.changes === 0) {
        return res.status(404).json({ error: "order not found" });
      }

      res.json({ ok: true, id, status: nextStatus });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/:id/history", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "invalid order id" });
      }

      const orderExists = db
        .prepare(
          `
        SELECT id
        FROM orders
        WHERE id = ? AND restaurant_id = ?
      `
        )
        .get(id, req.restaurantId);

      if (!orderExists) {
        return res.status(404).json({ error: "order not found" });
      }

      const history = db
        .prepare(
          `
        SELECT
          from_status,
          to_status,
          changed_at,
          changed_by_role,
          changed_by_user_id
        FROM order_status_history
        WHERE order_id = ? AND restaurant_id = ?
        ORDER BY id ASC
      `
        )
        .all(id, req.restaurantId);

      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

module.exports = { createOrdersRouter };
