import { supabase } from '../../lib/supabase.js';
import { answerCallbackQuery, sendMessage } from '../../lib/telegram.js';
import { publishToInstagram } from '../../lib/instagram.js';

export default async function handler(req, res) {
  const update = req.body;
  const callback = update.callback_query;
  if (!callback) return res.status(200).end(); // ignora update non rilevanti

  const [action, id] = callback.data.split(':');
  const chatId = callback.message.chat.id;

  try {
    switch (action) {
      case 'approve_week': {
        await supabase
          .from('content_calendar')
          .update({ status: 'calendar_approved' })
          .eq('week_start', id);
        await answerCallbackQuery(callback.id, 'Calendario approvato ✅');
        await sendMessage(chatId, `Calendario della settimana ${id} approvato. Ti scriverò quando i contenuti saranno pronti.`);
        break;
      }

      case 'reject_week': {
        await supabase.from('content_calendar').delete().eq('week_start', id);
        await answerCallbackQuery(callback.id, 'Calendario scartato');
        await sendMessage(chatId, `Ok, calendario scartato. Puoi rilanciare la generazione manualmente quando vuoi.`);
        break;
      }

      case 'approve_post': {
        const { data: post } = await supabase
          .from('posts')
          .update({ status: 'approved' })
          .eq('id', id)
          .select()
          .single();

        await answerCallbackQuery(callback.id, 'Pubblicazione in corso...');

        if (!post.image_url) {
          await sendMessage(chatId, `⚠️ Manca l'URL immagine per questo post: caricala e aggiorna il record prima che possa pubblicare.`);
          break;
        }

        const igPostId = await publishToInstagram({
          imageUrl: post.image_url,
          caption: post.caption,
        });

        await supabase
          .from('posts')
          .update({ status: 'published', ig_media_id: igPostId, published_at: new Date().toISOString() })
          .eq('id', id);

        await sendMessage(chatId, `🚀 Pubblicato su Instagram! (ID: ${igPostId})`);
        break;
      }

      case 'reject_post': {
        await supabase.from('posts').update({ status: 'rejected' }).eq('id', id);
        await answerCallbackQuery(callback.id, 'Scartato, verrà rigenerato');
        await sendMessage(chatId, `Contenuto scartato. Rilancia la generazione quando vuoi.`);
        break;
      }

      default:
        await answerCallbackQuery(callback.id);
    }
  } catch (err) {
    await answerCallbackQuery(callback.id, 'Errore ⚠️');
    await sendMessage(chatId, `Errore durante l'operazione: ${err.message}`);
  }

  return res.status(200).end();
}
