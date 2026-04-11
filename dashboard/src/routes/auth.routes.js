const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function createAuthRouter({ db, jwtSecret, jwtExpiresIn, adminEmail, adminPassword }) {
  const router = express.Router();

  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "email and password must exists" });
      }

      const restaurant = db
        .prepare(
          `
      SELECT id, email, password_hash, is_active
      FROM restaurants
      WHERE email = ?
    `
        )
        .get(email);

      if (!restaurant) {
        return res.status(400).json({ error: "invalid email or password" });
      }

      const ok = await bcrypt.compare(password, restaurant.password_hash);
      if (!ok) {
        return res.status(400).json({ error: "invalid email or password" });
      }
      if (Number(restaurant.is_active) !== 1) {
        console.log(`[auth] login denied for inactive restaurant id=${restaurant.id}`);
        return res.status(403).json({
          error: "restaurant account is disabled",
          code: "RESTAURANT_DISABLED",
        });
      }

      const token = jwt.sign(
        {
          restaurant_id: restaurant.id,
          email: restaurant.email,
          role: "restaurant",
        },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      );

      return res.json({ token });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({ error: "internal server error" });
    }
  });

  router.post("/admin-login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "email and password must exists" });
      }

      if (email !== adminEmail || password !== adminPassword) {
        return res.status(400).json({ error: "invalid email or password" });
      }

      const token = jwt.sign(
        {
          role: "admin",
          email,
        },
        jwtSecret,
        { expiresIn: jwtExpiresIn }
      );

      return res.json({ token });
    } catch (error) {
      console.log(error.message);
      return res.status(500).json({ error: "internal server error" });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
