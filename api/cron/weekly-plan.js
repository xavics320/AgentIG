import { supabase } from '../../lib/supabase.js';
import { generateWeeklyPlan } from '../../lib/claude.js';
import { sendMessage } from '../../lib/telegram.js';

// Chiamato da Vercel Cron ogni lunedì mattina
export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const weekStart = new Date().toISOString().split('T')[0];
  const brand = 'Xavi - sviluppatore front-end freelance, React/JS, clienti PMI e artigiani italiani';

  const plan = await generateWeeklyPlan({ weekStart, brand });

  // Salva ogni post proposto nel DB
  const rows = plan.map((p) => ({
    week_start: weekStart,
    post_date: p.post_date,
    content_type: p.content_type,
    topic_summary: p.topic_summary,
    status: 'proposed',
  }));

  const { data: inserted, error } = await supabase
    .from('content_calendar')
    .insert(rows)
    .select();

  if (error) return res.status(500).json({ error });

  // Manda il riepilogo su Telegram con un bottone di approvazione per riga
  let text = `📅 *Proposta calendario settimana ${weekStart}*\n\n`;
  inserted.forEach((row, i) => {
    text += `${i + 1}. *${row.post_date}* — ${row.content_type}\n   ${row.topic_summary}\n\n`;
  });
  text += `Approvi l'intero calendario?`;

  await sendMessage(process.env.TELEGRAM_CHAT_ID, text, [
    { text: '✅ Approva tutto', callback_data: `approve_week:${weekStart}` },
    { text: '❌ Rigenera', callback_data: `reject_week:${weekStart}` },
  ]);

  return res.status(200).json({ ok: true, count: inserted.length });
}
