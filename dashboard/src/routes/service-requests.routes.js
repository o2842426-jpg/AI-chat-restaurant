const express = require("express");

function createServiceRequestsRouter({ db }) {
  const router = express.Router();

  /** GET /api/service-requests — pending only, scoped to JWT restaurant */
  router.get("/", (req, res) => {
    try {
      const rows = db
        .prepare(
          `
          SELECT id, restaurant_id, table_number, request_type, status, created_at
          FROM service_requests
          WHERE restaurant_id = ? AND status = 'pending'
          ORDER BY datetime(created_at) ASC
        `
        )
        .all(req.restaurantId);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /** PATCH /api/service-requests/:id/done — mark one row done for this restaurant */
  router.patch("/:id/done", (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res.status(400).json({ error: "invalid id" });
      }

      const row = db
        .prepare(`SELECT id, status FROM service_requests WHERE id = ? AND restaurant_id = ?`)
        .get(id, req.restaurantId);
      if (!row) {
        return res.status(404).json({ error: "not found" });
      }

      db.prepare(
        `UPDATE service_requests SET status = 'done' WHERE id = ? AND restaurant_id = ?`
      ).run(id, req.restaurantId);

      return res.json({ ok: true, id, status: "done" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createServiceRequestsRouter };
