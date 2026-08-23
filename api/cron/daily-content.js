import { supabase } from '../../lib/supabase.js';
import { generatePostContent } from '../../lib/claude.js';
import { generateImage } from '../../lib/imagegen.js';
import { applyLogo } from '../../lib/branding.js';
import { uploadImage } from '../../lib/storage.js';
import { sendPhoto } from '../../lib/telegram.js';

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
    try {
      console.log(`[${entry.id}] Inizio generazione contenuto testuale...`);
      const content = await generatePostContent({
        contentType: entry.content_type,
        topicSummary: entry.topic_summary,
        brand,
      });
      console.log(`[${entry.id}] Contenuto testuale generato. Caption length: ${content.caption?.length}, image_prompt: ${content.image_prompt?.slice(0, 60)}...`);

      console.log(`[${entry.id}] Chiamata a OpenAI per generare l'immagine...`);
      const imageBase64 = await generateImage(content.image_prompt);
      console.log(`[${entry.id}] Immagine ricevuta da OpenAI. Lunghezza base64: ${imageBase64?.length}`);

      console.log(`[${entry.id}] Applico il logo sopra l'immagine generata...`);
      const finalImageBuffer = await applyLogo(imageBase64);
      console.log(`[${entry.id}] Logo applicato. Dimensione buffer finale: ${finalImageBuffer.length} byte`);

      const filename = `post-${entry.id}-${Date.now()}.png`;
      console.log(`[${entry.id}] Upload su Supabase Storage con nome file: ${filename}`);
      const imageUrl = await uploadImage(finalImageBuffer, filename);
      console.log(`[${entry.id}] Upload completato. URL pubblico: ${imageUrl}`);

      const { data: post, error: insertError } = await supabase
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

      if (insertError || !post) {
        console.error(`[${entry.id}] Errore inserimento riga posts:`, insertError);
        continue; // passa alla prossima entry invece di interrompere tutto
      }
      console.log(`[${entry.id}] Riga posts creata con id: ${post.id}`);

      await supabase
        .from('content_calendar')
        .update({ status: 'content_generated' })
        .eq('id', entry.id);

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
        console.error(`[${entry.id}] Invio Telegram fallito:`, telegramResult);
      } else {
        console.log(`[${entry.id}] Foto inviata su Telegram con successo.`);
      }
    } catch (err) {
      // Cattura QUALSIASI errore imprevisto in questa singola entry,
      // lo stampa per intero nei log, e permette al ciclo di continuare
      console.error(`[${entry.id}] Errore imprevisto:`, err.message, err.stack);
    }
  }

  return res.status(200).json({ ok: true, processed: dueEntries.length });
}