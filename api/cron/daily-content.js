import { supabase } from '../../lib/supabase.js';
import { generatePostContent } from '../../lib/claude.js';
import { generateImage } from '../../lib/imagegen.js';
import { uploadImage } from '../../lib/storage.js';
import { sendMessage, sendPhoto } from '../../lib/telegram.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const today = new Date().toISOString().split('T')[0];
  const brand = 'Xavi - sviluppatore front-end freelance, React/JS, clienti PMI e artigiani italiani';

  const { data: dueEntries, error } = await supabase
    .from('content_calendar')
    .select('*')
    .eq('post_date', today)
    .eq('status', 'calendar_approved');

  if (error) return res.status(500).json({ error });
  if (!dueEntries.length) return res.status(200).json({ ok: true, message: 'Nessun post previsto oggi' });

  const errors = [];

  for (const entry of dueEntries) {
    try {
      const content = await generatePostContent({
        contentType: entry.content_type,
        topicSummary: entry.topic_summary,
        brand,
      });

      // Genera l'immagine con OpenAI a partire dal prompt scritto da Claude,
      // poi la carica su Supabase Storage per ottenere un URL pubblico
      const imageBase64 = await generateImage(content.image_prompt);
      const filename = `post-${entry.id}-${Date.now()}.png`;
      const imageUrl = await uploadImage(imageBase64, filename);

      const { data: post } = await supabase
        .from('posts')
        .insert({
          calendar_id: entry.id,
          caption: content.caption,
          image_prompt: content.image_prompt,
          image_url: imageUrl,
          status: 'pending',
        })
        .select()
        .single();

      await supabase
        .from('content_calendar')
        .update({ status: 'content_generated' })
        .eq('id', entry.id);

      // Manda l'immagine vera (non solo testo) cosi' puoi valutarla prima di approvare.
      // Controlliamo result.ok perche' Telegram puo' rispondere con status 200
      // anche in caso di errore logico (es. URL immagine non raggiungibile)
      const telegramResult = await sendPhoto(
        process.env.TELEGRAM_CHAT_ID,
        imageUrl,
        `✍️ *Contenuto pronto per il ${entry.post_date}*\n\n${content.caption}`,
        [
          { text: '✅ Approva', callback_data: `approve_post:${post.id}` },
          { text: '❌ Rigenera', callback_data: `reject_post:${post.id}` },
        ]
      );

      if (!telegramResult.ok) {
        console.error('Invio Telegram fallito:', telegramResult);
      }
    } catch (err) {
      // Un errore su un singolo post (es. API immagine/Claude non raggiungibile)
      // non deve bloccare gli altri post previsti oggi, e va notificato
      // invece di fallire in silenzio.
      console.error(`Errore generazione contenuto per entry ${entry.id}:`, err);
      errors.push({ entryId: entry.id, error: err.message });
      await sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `⚠️ Errore nella generazione del contenuto per il ${entry.post_date}:\n${err.message}`
      );
    }
  }

  return res.status(200).json({ ok: errors.length === 0, processed: dueEntries.length, errors });
}
