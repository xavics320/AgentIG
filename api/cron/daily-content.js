import { supabase } from '../../lib/supabase.js';
import { generatePostContent } from '../../lib/claude.js';
import { sendMessage } from '../../lib/telegram.js';

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

  for (const entry of dueEntries) {
    const content = await generatePostContent({
      contentType: entry.content_type,
      topicSummary: entry.topic_summary,
      brand,
    });

    const { data: post } = await supabase
      .from('posts')
      .insert({
        calendar_id: entry.id,
        caption: content.caption,
        image_prompt: content.image_prompt,
        status: 'pending',
      })
      .select()
      .single();

    await supabase
      .from('content_calendar')
      .update({ status: 'content_generated' })
      .eq('id', entry.id);

    // NOTA: qui manca la generazione/scelta immagine effettiva.
    // Opzioni: generarla con un modello immagini e caricarla su storage pubblico (es. Vercel Blob, Supabase Storage),
    // oppure mandarti solo il prompt e caricare tu manualmente il file prima di approvare.
    await sendMessage(
      process.env.TELEGRAM_CHAT_ID,
      `✍️ *Contenuto pronto per il ${entry.post_date}*\n\n*Caption:*\n${content.caption}\n\n*Immagine suggerita:*\n${content.image_prompt}`,
      [
        { text: '✅ Approva', callback_data: `approve_post:${post.id}` },
        { text: '❌ Rigenera', callback_data: `reject_post:${post.id}` },
      ]
    );
  }

  return res.status(200).json({ ok: true, processed: dueEntries.length });
}
