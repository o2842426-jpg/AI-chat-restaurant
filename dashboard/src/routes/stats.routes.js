const express = require("express");

function createStatsRouter({ db, getPeriodBounds, isoForSql, buildRevenueSeries }) {
  const router = express.Router();

  router.get("/", (req, res) => {
    try {
      let raw = req.query.period ?? "month";
      if (Array.isArray(raw)) raw = raw[0];
      raw = String(raw).trim().toLowerCase();
      const allowed = ["day", "week", "month", "year", "all"];
      const period = allowed.includes(raw) ? raw : "month";
      const { start, end } = getPeriodBounds(period);
      const rid = req.restaurantId;
      const s = isoForSql(start);
      const e = isoForSql(end);

      const nonDraft = `LOWER(COALESCE(o.status,'')) IN ('confirmed','preparing','ready','delivered')`;

      const ordersCount = db
        .prepare(
          `
      SELECT COUNT(*) AS count
      FROM orders o
      WHERE o.restaurant_id = ?
        AND ${nonDraft}
        AND o.created_at >= ?
        AND o.created_at <= ?
    `
        )
        .get(rid, s, e);

      const topProducts = db
        .prepare(
          `
      SELECT MAX(COALESCE(oi.item_name_snapshot, mi.name)) AS name, SUM(oi.quantity) AS total
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = ?
        AND ${nonDraft}
        AND o.created_at >= ?
        AND o.created_at <= ?
      GROUP BY oi.menu_item_id
      ORDER BY total DESC
      LIMIT 5
    `
        )
        .all(rid, s, e);

      const revenueRow = db
        .prepare(
          `
      SELECT COALESCE(SUM(COALESCE(oi.line_total_snapshot, oi.quantity * COALESCE(oi.unit_price_snapshot, mi.price))), 0) AS total
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.restaurant_id = ?
        AND ${nonDraft}
        AND o.created_at >= ?
        AND o.created_at <= ?
    `
        )
        .get(rid, s, e);

      const todayStr = new Date().toISOString().slice(0, 10);
      const ordersTodayRow = db
        .prepare(
          `
      SELECT COUNT(*) AS count
      FROM orders o
      WHERE o.restaurant_id = ?
        AND ${nonDraft}
        AND date(o.created_at) = date(?)
    `
        )
        .get(rid, todayStr);

      let series = buildRevenueSeries(db, rid, period, start, end);
      if (!Array.isArray(series)) series = [];
      if (period === "day" && series.length === 0) {
        series = ["0-4", "4-8", "8-12", "12-16", "16-20", "20-24"].map((label) => ({
          label,
          revenue: 0,
        }));
      }

      res.json({
        period,
        ordersCount: ordersCount.count,
        ordersToday: ordersTodayRow.count,
        topProducts,
        revenue: revenueRow?.total ?? 0,
        series,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createStatsRouter };
