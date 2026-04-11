/**
 * Safe check: loads the same .env files as dashboard/server.js and verifies
 * BOT_TOKEN + KITCHEN_GROUP_ID without printing secrets.
 *
 * Usage (from repo root):
 *   node scripts/check-kitchen-telegram.js
 */
const path = require("path");
const https = require("https");

const dashboardDir = path.join(__dirname, "..", "dashboard");
// Use dashboard's dotenv (same as API)
// eslint-disable-next-line import/no-dynamic-require
require(path.join(dashboardDir, "node_modules", "dotenv")).config({
  path: path.join(dashboardDir, ".env"),
});
require(path.join(dashboardDir, "node_modules", "dotenv")).config({
  path: path.join(__dirname, "..", "bot", ".env"),
});

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || "";
const kid = process.env.KITCHEN_GROUP_ID;

console.log("--- Kitchen Telegram check ---");
console.log("BOT_TOKEN (or TELEGRAM_BOT_TOKEN):", token ? `set (${token.length} chars)` : "MISSING");
console.log("KITCHEN_GROUP_ID:", kid === undefined ? "(unset)" : kid === "" ? '(empty string)' : `"${kid}"`);

if (!token) {
  console.log("\nFix: add BOT_TOKEN to bot/.env (same token as the Python bot).");
  process.exit(1);
}

https
  .get(`https://api.telegram.org/bot${token}/getMe`, (res) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      try {
        const j = JSON.parse(body);
        if (j.ok) {
          console.log("getMe OK: bot @" + (j.result.username || "?"));
        } else {
          console.log("getMe FAILED:", body.slice(0, 300));
        }
      } catch {
        console.log("getMe parse error:", body.slice(0, 200));
      }
      console.log(
        "\nIf KITCHEN_GROUP_ID is wrong or unset: use a group numeric id (often negative, e.g. -100...)."
      );
      console.log("Add the bot to the kitchen group, then paste that id into bot/.env as KITCHEN_GROUP_ID.");
      console.log("If restaurants.telegram_group_id is set in SQLite, it overrides KITCHEN_GROUP_ID.");
    });
  })
  .on("error", (e) => console.error("network error:", e.message));
