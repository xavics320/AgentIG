import { supabase } from "./supabase.js";
import { generateWeeklyPlan } from "./claude.js";
import { sendMessage } from "./telegram.js";

export async function createWeeklyPlan ({client, weekStart, extraInstructions, replaceIds = []}) {
    const plan = await generateWeeklyPlan ({
        weekStart,
        brand: client.brand_description,
        postsPerWeek: client.posts_per_week,
        extraInstructions,
    });

    const rows = plan.map ((p) => ({
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

    if (insertError) throw new Error(`Errore inserimento calendario: ${insertError.message}`);

    //Le vecchie proposte si cancellano solo dopo che le nuove sono state salvate,
    //e per id (non per week_start, che cancellerebbe anche le righe create)
if (replaceIds.length) {
    await supabase.from('content_calendar').delete().in('id', replaceIds);
}

let text = `📅 *Proposta calendario settimana ${weekStart}*\n\n`;
inserted.forEach((row, i) => {
    text += `${i + 1}. *${row.post_date}* — ${row.content_type}\n   ${row.topic_summary}\n\n`;
  });
  text += `Approvi l'intero calendario?`;

  const telegramResult = await sendMessage(client.telegram_chat_id, text, [
    { text: '✅ Approva tutto', callback_data: `approve_week:${weekStart}:${client.id}` },
    { text: '❌ Rigenera', callback_data: `reject_week:${weekStart}:${client.id}` },
  ]);

  if (!telegramResult.ok) throw new Error('Invio Telegram fallito');

  return inserted;
}