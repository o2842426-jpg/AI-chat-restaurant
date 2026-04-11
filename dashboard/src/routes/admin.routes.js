const express = require("express");
const bcrypt = require("bcryptjs");

function createAdminRouter({ db, adminAuth }) {
  const router = express.Router();

  router.get("/restaurants", adminAuth, (req, res) => {
    try {
      const rows = db
        .prepare(
          `
      SELECT id, name, email, telegram_group_id, created_at, is_active
      FROM restaurants
      ORDER BY id ASC
    `
        )
        .all();

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/restaurants", adminAuth, async (req, res) => {
    try {
      const { name, email, password, telegram_group_id } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: "name, email, password are required" });
      }

      const exists = db
        .prepare(
          `
      SELECT id FROM restaurants WHERE email = ?
    `
        )
        .get(email);

      if (exists) {
        return res.status(400).json({ error: "email already exists" });
      }

      const hash = await bcrypt.hash(password, 10);

      const info = db
        .prepare(
          `
      INSERT INTO restaurants (name, email, password_hash, telegram_group_id, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `
        )
        .run(name, email, hash, telegram_group_id || null);

      const created = db
        .prepare(
          `
      SELECT id, name, email, telegram_group_id, created_at, is_active
      FROM restaurants
      WHERE id = ?
    `
        )
        .get(info.lastInsertRowid);

      res.status(201).json(created);
    } catch (err) {
      console.log(err.message);
      res.status(500).json({ error: "internal server error" });
    }
  });

  router.patch("/restaurants/:id/activation", adminAuth, (req, res) => {
    try {
      const restaurantId = Number(req.params.id);
      const { is_active } = req.body;
      if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
        return res.status(400).json({ error: "invalid restaurant id" });
      }
      if (![0, 1, true, false].includes(is_active)) {
        return res.status(400).json({ error: "is_active must be 0 or 1" });
      }
      const targetState = Number(Boolean(is_active));
      const exists = db.prepare("SELECT id FROM restaurants WHERE id = ?").get(restaurantId);
      if (!exists) {
        return res.status(404).json({ error: "restaurant not found" });
      }
      db.prepare("UPDATE restaurants SET is_active = ? WHERE id = ?").run(targetState, restaurantId);
      const updated = db
        .prepare(
          `
          SELECT id, name, email, telegram_group_id, created_at, is_active
          FROM restaurants
          WHERE id = ?
        `
        )
        .get(restaurantId);
      return res.json(updated);
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ error: "internal server error" });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
