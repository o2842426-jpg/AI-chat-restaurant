function getPeriodBounds(period) {
  const now = new Date();
  let start = new Date(now);

  if (period === "day") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    const dow = now.getDay();
    const toMonday = dow === 0 ? -6 : 1 - dow;
    start.setDate(now.getDate() + toMonday);
    start.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else if (period === "year") {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
  } else {
    start = new Date(0);
  }

  return { start, end: now };
}

function isoForSql(d) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

function buildRevenueSeries(db, restaurantId, period, start, end) {
  const s = isoForSql(start);
  const e = isoForSql(end);

  const baseWhere = `
    o.restaurant_id = ?
    AND LOWER(COALESCE(o.status,'')) IN ('confirmed','preparing','ready','delivered')
    AND o.created_at >= ?
    AND o.created_at <= ?
  `;

  if (period === "day") {
    const rows = db
      .prepare(
        `
      SELECT
        CAST(strftime('%H', o.created_at) AS INTEGER) / 4 AS bucket,
        COALESCE(SUM(COALESCE(oi.line_total_snapshot, oi.quantity * COALESCE(oi.unit_price_snapshot, mi.price))), 0) AS rev
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${baseWhere}
      GROUP BY CAST(strftime('%H', o.created_at) AS INTEGER) / 4
    `
      )
      .all(restaurantId, s, e);

    const map = {};
    rows.forEach((r) => {
      map[Number(r.bucket)] = Number(r.rev);
    });
    const labels = ["0-4", "4-8", "8-12", "12-16", "16-20", "20-24"];
    return labels.map((label, i) => ({
      label,
      revenue: map[i] ?? 0,
    }));
  }

  if (period === "week") {
    const rows = db
      .prepare(
        `
      SELECT date(o.created_at) AS d, COALESCE(SUM(COALESCE(oi.line_total_snapshot, oi.quantity * COALESCE(oi.unit_price_snapshot, mi.price))), 0) AS rev
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${baseWhere}
      GROUP BY date(o.created_at)
    `
      )
      .all(restaurantId, s, e);

    const map = Object.fromEntries(rows.map((r) => [r.d, Number(r.rev)]));
    const out = [];
    const cur = new Date(start);
    const dayNames = ["إث", "ث", "أر", "خ", "ج", "س", "ح"];
    for (let i = 0; i < 7; i++) {
      const key = cur.toISOString().slice(0, 10);
      out.push({
        label: dayNames[i] || key.slice(5),
        revenue: map[key] ?? 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  if (period === "month") {
    const rows = db
      .prepare(
        `
      SELECT date(o.created_at) AS d, COALESCE(SUM(COALESCE(oi.line_total_snapshot, oi.quantity * COALESCE(oi.unit_price_snapshot, mi.price))), 0) AS rev
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${baseWhere}
      GROUP BY date(o.created_at)
    `
      )
      .all(restaurantId, s, e);

    const map = Object.fromEntries(rows.map((r) => [r.d, Number(r.rev)]));
    const out = [];
    const endRef = new Date(end);
    const lastDay = Math.min(
      endRef.getDate(),
      new Date(endRef.getFullYear(), endRef.getMonth() + 1, 0).getDate()
    );
    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(start.getFullYear(), start.getMonth(), day);
      const key = d.toISOString().slice(0, 10);
      out.push({
        label: String(day),
        revenue: map[key] ?? 0,
      });
    }
    return out;
  }

  if (period === "year") {
    const rows = db
      .prepare(
        `
      SELECT strftime('%m', o.created_at) AS m, COALESCE(SUM(COALESCE(oi.line_total_snapshot, oi.quantity * COALESCE(oi.unit_price_snapshot, mi.price))), 0) AS rev
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE ${baseWhere}
      GROUP BY strftime('%m', o.created_at)
    `
      )
      .all(restaurantId, s, e);

    const map = {};
    rows.forEach((r) => {
      map[String(Number(r.m))] = Number(r.rev);
    });
    const monthLabels = [
      "ينا",
      "فبر",
      "مار",
      "أبر",
      "ماي",
      "يون",
      "يول",
      "أغس",
      "سبت",
      "أكت",
      "نوف",
      "ديس",
    ];
    return monthLabels.map((label, i) => ({
      label,
      revenue: map[String(i + 1)] ?? 0,
    }));
  }

  const rows = db
    .prepare(
      `
    SELECT strftime('%Y-%m', o.created_at) AS ym, COALESCE(SUM(COALESCE(oi.line_total_snapshot, oi.quantity * COALESCE(oi.unit_price_snapshot, mi.price))), 0) AS rev
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN menu_items mi ON mi.id = oi.menu_item_id
    WHERE o.restaurant_id = ?
      AND LOWER(COALESCE(o.status,'')) IN ('confirmed','preparing','ready','delivered')
    GROUP BY strftime('%Y-%m', o.created_at)
    ORDER BY ym DESC
    LIMIT 12
  `
    )
    .all(restaurantId);

  return rows.reverse().map((r) => ({ label: r.ym, revenue: Number(r.rev) }));
}

module.exports = {
  getPeriodBounds,
  isoForSql,
  buildRevenueSeries,
};
