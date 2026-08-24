import { supabase } from '../../lib/supabase.js';
import { generateWeeklyPlan } from '../../lib/claude.js';
import { sendMessage } from '../../lib/telegram.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const weekStart = new Date().toISOString().split('T')[0];

  // Legge tutti i clienti attivi: ognuno riceve la propria proposta
  // di calendario, generata con il proprio brand e la propria frequenza
  const { data: clients, error: clientsError } = await supabase
    .from('clients')
    .select('*')
    .eq('is_active', true);

  if (clientsError) return res.status(500).json({ error: clientsError });

  const results = [];

  for (const client of clients) {
    try {
      const plan = await generateWeeklyPlan({
        weekStart,
        brand: client.brand_description,
        postsPerWeek: client.posts_per_week,
      });

      const rows = plan.map((p) => ({
        client_id: client.id,
        week_start: weekStart,
        post_date: p.post_date,
        content_type: p.content_type,
        topic_summary: p.topic_summary,
        status: 'proposed',
      }));

      const { data: inserted, error: insertError } = await supabase
        .from('content_calendar')
        .insert(rows)
        .select();

      if (insertError) {
        console.error(`[${client.id}] Errore inserimento calendario:`, insertError);
        results.push({ clientId: client.id, ok: false, error: insertError.message });
        continue;
      }

      let text = `📅 *Proposta calendario settimana ${weekStart}*\n\n`;
      inserted.forEach((row, i) => {
        text += `${i + 1}. *${row.post_date}* — ${row.content_type}\n   ${row.topic_summary}\n\n`;
      });
      text += `Approvi l'intero calendario?`;

      await sendMessage(client.telegram_chat_id, text, [
        { text: '✅ Approva tutto', callback_data: `approve_week:${weekStart}:${client.id}` },
        { text: '❌ Rigenera', callback_data: `reject_week:${weekStart}:${client.id}` },
      ]);

      results.push({ clientId: client.id, ok: true, count: inserted.length });
    } catch (err) {
      console.error(`[${client.id}] Errore imprevisto:`, err.message);
      results.push({ clientId: client.id, ok: false, error: err.message });
    }
  }

  return res.status(200).json({ ok: true, results });
}