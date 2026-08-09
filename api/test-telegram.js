import { sendMessage } from "../lib/telegram.js";

// Endpoint di solo test: GET /api/test-telegram
// Serve a verificare che le variabili d'ambiente TELEGRAM_BOT_TOKEN e
// TELEGRAM_CHAT_ID siano configurate correttamente su Vercel, prima di
// coinvolgere Supabase o Claude nel flusso.
export default async function handler(req, res) {
  try {
    const result = await sendMessage(
      process.env.TELEGRAM_CHAT_ID,
      "✅ Test riuscito! Vercel e Telegram si parlano correttamente.",
    );

    if (!result.ok) {
      // Telegram risponde comunque con status 200 anche in caso di errore logico,
      // quindi controlliamo il campo "ok" della risposta, non solo lo status HTTP
      return res.status(500).json({ success: false, telegramError: result });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
