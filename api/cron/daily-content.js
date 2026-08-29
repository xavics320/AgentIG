import { supabase } from '../../lib/supabase.js';
import { generatePostAssets } from '../../lib/postGenerator.js';
import { sendPhoto } from '../../lib/telegram.js';
import { getTodayInTimezone } from '../../lib/dateUtils.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const today = getTodayInTimezone();

  const { data: dueEntries, error } = await supabase
    .from('content_calendar')
    .select('*, clients(*)')
    .eq('post_date', today)
    .eq('status', 'calendar_approved');

  if (error) return res.status(500).json({ error });
  if (!dueEntries.length) return res.status(200).json({ ok: true, message: 'Nessun post previsto oggi' });

  for (const entry of dueEntries) {
    const client = entry.clients;
    try {
      console.log(`[${entry.id}] Cliente: ${client.name}. Inizio generazione contenuto...`);

      const { caption, imagePrompt, imageUrl } = await generatePostAssets({
        client,
        contentType: entry.content_type,
        topicSummary: entry.topic_summary,
      });
      console.log(`[${entry.id}] Contenuto e immagine generati. URL: ${imageUrl}`);

      const { data: post, error: insertError } = await supabase
        .from('posts')
        .insert({
          client_id: client.id,
          calendar_id: entry.id,
          caption,
          image_prompt: imagePrompt,
          image_url: imageUrl,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError || !post) {
        console.error(`[${entry.id}] Errore inserimento riga posts:`, insertError);
        continue;
      }
      console.log(`[${entry.id}] Riga posts creata con id: ${post.id}`);

      await supabase
        .from('content_calendar')
        .update({ status: 'content_generated' })
        .eq('id', entry.id);

      const telegramResult = await sendPhoto(
        client.telegram_chat_id,
        imageUrl,
        `✍️ *Contenuto pronto per il ${entry.post_date}*\n\n${caption}`,
        [
          { text: '✅ Approva', callback_data: `approve_post:${post.id}` },
          { text: '❌ Rigenera', callback_data: `reject_post:${post.id}` },
        ]
      );

      if (!telegramResult.ok) {
        console.error(`[${entry.id}] Invio Telegram fallito:`, telegramResult);
      } else {
        console.log(`[${entry.id}] Foto inviata su Telegram con successo.`);
      }
    } catch (err) {
      console.error(`[${entry.id}] Errore imprevisto:`, err.message, err.stack);
    }
  }

  return res.status(200).json({ ok: true, processed: dueEntries.length });
}