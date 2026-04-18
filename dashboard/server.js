const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", "bot", ".env") });

const express = require("express");
const cors = require("cors");
const db = require("./db");
const { PORT, JWT_SECRET, JWT_EXPIRES_IN, ADMIN_EMAIL, ADMIN_PASSWORD } = require("./src/config");
const { authMiddleware, adminAuthMiddleware } = require("./src/middleware/auth");
const { getPeriodBounds, isoForSql, buildRevenueSeries } = require("./src/services/stats");
const { createAuthRouter } = require("./src/routes/auth.routes");
const { createAdminRouter } = require("./src/routes/admin.routes");
const { createOrdersRouter } = require("./src/routes/orders.routes");
const { createMenuRouter } = require("./src/routes/menu.routes");
const { createStatsRouter } = require("./src/routes/stats.routes");
const { createServiceRequestsRouter } = require("./src/routes/service-requests.routes");
const { createPublicRouter } = require("./src/routes/public.routes");
const { isTelegramKitchenDisabled } = require("./src/services/telegramKitchen");

const app = express();

function sendHealthJson(res) {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, service: "restaurant-dashboard-api" });
}

// First middleware: health must never depend on deploy order or req.path quirks.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const pathname = (req.originalUrl || "").split("?")[0].replace(/\/+$/, "") || "/";
  if (pathname === "/api/health" || pathname === "/health") {
    return sendHealthJson(res);
  }
  next();
});

app.use(cors());
app.use(express.json());

app.use(
  "/api/auth",
  createAuthRouter({
    db,
    jwtSecret: JWT_SECRET,
    jwtExpiresIn: JWT_EXPIRES_IN,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  })
);

app.use(
  "/api/admin",
  createAdminRouter({
    db,
    adminAuth: adminAuthMiddleware(JWT_SECRET),
  })
);

const publicRouter = createPublicRouter({
  db,
  telegramBotToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "",
});
// Standard path (Vite dev proxy, correct nginx that keeps full URI):
app.use("/api/public", publicRouter);
// Some nginx configs use `proxy_pass http://127.0.0.1:3000/;` under `location /api/` which
// strips the /api prefix — browser calls /api/public/menu/4 but Node receives /public/menu/4.
app.use("/public", publicRouter);

// من هذه النقطة وما بعدها، كل المسارات تحتاج توكن مطعم صحيح
app.use(authMiddleware(JWT_SECRET, db));

app.use("/api/orders", createOrdersRouter({ db }));
app.use("/api/menu", createMenuRouter({ db }));
app.use("/api/service-requests", createServiceRequestsRouter({ db }));
app.use(
  "/api/stats",
  createStatsRouter({
    db,
    getPeriodBounds,
    isoForSql,
    buildRevenueSeries,
  })
);




app.listen(PORT, () => {
  const hasToken = Boolean(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  const kitchenEnv = process.env.KITCHEN_GROUP_ID || "";
  console.log(`[startup] API started on port ${PORT}`);
  console.log(`[startup] DB path: ${path.join(__dirname, "..", "restaurant_bot.db")}`);
  console.log("[startup] Mode: single-tenant per restaurant deployment");
  if (isTelegramKitchenDisabled()) {
    console.log(
      "[startup] Kitchen Telegram: OFF (SKIP_TELEGRAM_KITCHEN) — no calls to api.telegram.org; orders still appear in the dashboard."
    );
  } else {
    console.log(
      `[startup] Kitchen Telegram: ON — bot token ${hasToken ? "loaded" : "MISSING"}, KITCHEN_GROUP_ID=${kitchenEnv || "(not set)"}. If you see ETIMEDOUT, set SKIP_TELEGRAM_KITCHEN=true in bot/.env`
    );
  }
});