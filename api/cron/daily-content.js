import { supabase } from '../../lib/supabase.js';
import { generatePostContent } from '../../lib/claude.js';
import { generateImage } from '../../lib/imageGen.js';
import { applyLogo } from '../../lib/branding.js';
import { uploadImage } from '../../lib/storage.js';
import { sendPhoto } from '../../lib/telegram.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  const today = new Date().toISOString().split('T')[0];

  // La select con "clients(*)" e' un JOIN: Supabase recupera in un colpo solo
  // sia la riga di content_calendar sia i dati del cliente collegato (tramite
  // la foreign key client_id), evitando una query separata per ogni entry.
  const { data: dueEntries, error } = await supabase
    .from('content_calendar')
    .select('*, clients(*)')
    .eq('post_date', today)
    .eq('status', 'calendar_approved');

  if (error) return res.status(500).json({ error });
  if (!dueEntries.length) return res.status(200).json({ ok: true, message: 'Nessun post previsto oggi' });

  for (const entry of dueEntries) {
    const client = entry.clients; // dati del cliente, gia' inclusi grazie al join
    try {
      console.log(`[${entry.id}] Cliente: ${client.name}. Inizio generazione contenuto...`);
      const content = await generatePostContent({
        contentType: entry.content_type,
        topicSummary: entry.topic_summary,
        brand: client.brand_description,
        style: {
          bgColor: client.style_bg_color,
          textColor: client.style_text_color,
          accentColor: client.style_accent_color,
        },
      });
      console.log(`[${entry.id}] Contenuto testuale generato.`);

      const imageBase64 = await generateImage(content.image_prompt);
      console.log(`[${entry.id}] Immagine ricevuta da OpenAI.`);

      const finalImageBuffer = await applyLogo(imageBase64, client.logo_url);
      console.log(`[${entry.id}] Logo applicato.`);

      const filename = `post-${entry.id}-${Date.now()}.png`;
      const imageUrl = await uploadImage(finalImageBuffer, filename);
      console.log(`[${entry.id}] Upload completato. URL: ${imageUrl}`);

      const { data: post, error: insertError } = await supabase
        .from('posts')
        .insert({
          client_id: client.id,
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
      console.error(`[${entry.id}] Errore imprevisto:`, err.message, err.stack);
    }
  }

  return res.status(200).json({ ok: true, processed: dueEntries.length });
}