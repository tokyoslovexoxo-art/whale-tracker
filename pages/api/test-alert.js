// Sends one test message through the same Telegram pipe the real alerts use.
// Visit /api/test-alert in your browser to confirm notifications reach your phone.

export default async function handler(req, res) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) {
    return res.status(500).json({ ok: false, error: "Missing TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN env vars" });
  }
  const msg = "\u2705 <b>Whale Tracker test alert</b>\n\nIf you can read this, your Telegram notifications are working. Real whale copy-trade alerts will arrive here automatically every 5 minutes when a tracked wallet makes a qualifying buy.";
  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "HTML" }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) {
      return res.status(500).json({ ok: false, telegram: data });
    }
    res.status(200).json({ ok: true, message: "Test alert sent. Check your Telegram." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
