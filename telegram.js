const TG_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chatId, text, inlineButtons = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };

  if (inlineButtons) {
    // inlineButtons: [{ text: "✅ Approva", callback_data: "approve:xyz" }, ...]
    body.reply_markup = { inline_keyboard: [inlineButtons] };
  }

  const res = await fetch(`${TG_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendPhoto(chatId, photoUrl, caption, inlineButtons = null) {
  const body = {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: 'Markdown',
  };
  if (inlineButtons) {
    body.reply_markup = { inline_keyboard: [inlineButtons] };
  }
  const res = await fetch(`${TG_API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// Risponde al callback per far sparire il "loading" sul bottone premuto
export async function answerCallbackQuery(callbackQueryId, text = '') {
  await fetch(`${TG_API}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  });
}
