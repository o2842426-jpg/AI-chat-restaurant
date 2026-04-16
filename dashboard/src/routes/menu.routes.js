const express = require("express");

function createMenuRouter({ db }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    try {
      const list = db
        .prepare(
          `
     SELECT *
     FROM menu_items
     WHERE restaurant_id = ?
     ORDER BY category, name
    `
        )
        .all(req.restaurantId);

      res.json(list);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/", (req, res) => {
    try {
      const { name, category, price, is_active } = req.body;

      if (!name || !category || price == null) {
        return res.status(400).json({ error: "name, category, price required" });
      }

      const restaurant_id = req.restaurantId;
      const isActiveVal = is_active == null ? 1 : (Number(is_active) === 0 ? 0 : 1);

      const info = db
        .prepare(
          `
      INSERT INTO menu_items (restaurant_id, name, category, price, is_active)
      VALUES (?, ?, ?, ?, ?)
    `
        )
        .run(restaurant_id, name, category, Number(price), isActiveVal);

      res.status(201).json({
        id: info.lastInsertRowid,
        restaurant_id,
        name,
        category,
        price: Number(price),
        is_active: isActiveVal,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/:id", (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, category, price, is_active } = req.body;

      if (!name || !category || price == null) {
        return res.status(400).json({ message: "name, category, price required" });
      }

      const isActiveProvided = is_active != null;
      const updateParts = ["name = ?", "category = ?", "price = ?"];
      const values = [name, category, Number(price)];
      if (isActiveProvided) {
        updateParts.push("is_active = ?");
        values.push(Number(is_active) === 0 ? 0 : 1);
      }

      const result = db
        .prepare(
          `
        UPDATE menu_items
        SET ${updateParts.join(", ")}
        WHERE id = ? AND restaurant_id = ?`
        )
        .run(...values, id, req.restaurantId);

      if (result.changes === 0) {
        return res.status(404).json({ error: "menu item not found" });
      }

      res.json({ ok: true, id, name, category, price: Number(price) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete("/:id", (req, res) => {
    try {
      const id = Number(req.params.id);

      const used = db
        .prepare(
          `
      SELECT COUNT(*) AS count
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE oi.menu_item_id = ? AND o.restaurant_id = ?
    `
        )
        .get(id, req.restaurantId);

      if (used.count > 0) {
        return res.status(400).json({ error: "Cannot delete: item is used in existing orders." });
      }

      const result = db.prepare(`
      DELETE FROM menu_items
      WHERE id = ? AND restaurant_id = ?
    `).run(id, req.restaurantId);

      if (result.changes === 0) {
        return res.status(404).json({ error: "menu item not found" });
      }

      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createMenuRouter };
