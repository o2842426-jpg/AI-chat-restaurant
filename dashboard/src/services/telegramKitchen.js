const https = require("https");

const HTTP_TIMEOUT_MS = Math.min(60000, Math.max(3000, Number(process.env.TELEGRAM_HTTP_TIMEOUT_MS || 8000)));

/** True → never call Telegram (use when network blocks api.telegram.org). */
function isTelegramKitchenDisabled() {
  const skip = String(process.env.SKIP_TELEGRAM_KITCHEN || "").toLowerCase();
  if (["1", "true", "yes", "on"].includes(skip)) return true;
  const en = String(process.env.TELEGRAM_KITCHEN_ENABLED ?? "true").toLowerCase();
  if (["0", "false", "no", "off"].includes(en)) return true;
  return false;
}

let loggedDisabledOnce = false;
let loggedNetworkHintOnce = false;

/**
 * Send a plain-text message to a Telegram chat (kitchen group).
 * Swallows errors — callers must not rely on success for business logic.
 */
function sendTelegramMessage(botToken, chatId, text) {
  if (isTelegramKitchenDisabled()) {
    if (!loggedDisabledOnce) {
      loggedDisabledOnce = true;
      console.log(
        "[telegramKitchen] disabled via SKIP_TELEGRAM_KITCHEN / TELEGRAM_KITCHEN_ENABLED=false — no HTTP to Telegram. Orders still save; use the dashboard."
      );
    }
    return Promise.resolve(false);
  }

  if (!botToken) {
    console.warn("[telegramKitchen] skip: no BOT_TOKEN / TELEGRAM_BOT_TOKEN (API process env)");
    return Promise.resolve(false);
  }
  if (chatId == null || chatId === "" || Number(chatId) === 0 || Number.isNaN(Number(chatId))) {
    console.warn(
      "[telegramKitchen] skip: no chat id — set KITCHEN_GROUP_ID in env or restaurants.telegram_group_id in DB"
    );
    return Promise.resolve(false);
  }

  const payload = JSON.stringify({
    chat_id: chatId,
    text: String(text).slice(0, 4000),
    disable_web_page_preview: true,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.telegram.org",
        path: `/bot${botToken}/sendMessage`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload, "utf8"),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const ok = res.statusCode >= 200 && res.statusCode < 300;
          if (!ok) {
            const body = Buffer.concat(chunks).toString("utf8").slice(0, 500);
            console.error("[telegramKitchen] Telegram API error", res.statusCode, body);
          } else {
            console.log("[telegramKitchen] message sent OK to chat_id=" + chatId);
          }
          resolve(ok);
        });
      }
    );

    req.setTimeout(HTTP_TIMEOUT_MS, () => {
      req.destroy();
    });

    req.on("error", (err) => {
      const code = err.code || "";
        const isNet = ["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "ECONNRESET"].includes(code);
      if (isNet && !loggedNetworkHintOnce) {
        loggedNetworkHintOnce = true;
        console.warn(
          `[telegramKitchen] cannot reach Telegram (${code}). Your network/firewall blocks api.telegram.org. ` +
            `Orders still work. Add SKIP_TELEGRAM_KITCHEN=true to bot/.env (or dashboard/.env) to stop retrying.`
        );
      } else if (!isNet) {
        console.error("[telegramKitchen] request failed:", err.message);
      }
      resolve(false);
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { sendTelegramMessage, isTelegramKitchenDisabled };
