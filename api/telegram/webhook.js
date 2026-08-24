import { supabase } from '../../lib/supabase.js';
import { answerCallbackQuery, sendMessage } from '../../lib/telegram.js';
import { publishToInstagram } from '../../lib/instagram.js';

export default async function handler(req, res) {
  const update = req.body;
  const callback = update.callback_query;
  if (!callback) return res.status(200).end();

  const [action, ...params] = callback.data.split(':');
  const chatId = callback.message.chat.id;

  try {
    switch (action) {
      case 'approve_week': {
        const [weekStart, clientId] = params;
        await supabase
          .from('content_calendar')
          .update({ status: 'calendar_approved' })
          .eq('week_start', weekStart)
          .eq('client_id', clientId);
        await answerCallbackQuery(callback.id, 'Calendario approvato ✅');
        await sendMessage(chatId, `Calendario della settimana ${weekStart} approvato.`);
        break;
      }

      case 'reject_week': {
        const [weekStart, clientId] = params;
        await supabase
          .from('content_calendar')
          .delete()
          .eq('week_start', weekStart)
          .eq('client_id', clientId);
        await answerCallbackQuery(callback.id, 'Calendario scartato');
        await sendMessage(chatId, `Ok, calendario scartato.`);
        break;
      }

      case 'approve_post': {
        const [postId] = params;

        const { data: post, error: updateError } = await supabase
          .from('posts')
          .update({ status: 'approved' })
          .eq('id', postId)
          .select()
          .single();

        if (updateError || !post) {
          await answerCallbackQuery(callback.id, 'Errore: post non trovato');
          break;
        }

        // Recupera le credenziali Instagram DEL CLIENTE SPECIFICO di questo post,
        // non piu' variabili globali: ogni cliente pubblica sul proprio account
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('ig_user_id, ig_access_token')
          .eq('id', post.client_id)
          .single();

        if (clientError || !client?.ig_access_token) {
          await answerCallbackQuery(callback.id, 'Errore credenziali');
          await sendMessage(chatId, `⚠️ Mancano le credenziali Instagram per questo cliente.`);
          break;
        }

        await answerCallbackQuery(callback.id, 'Pubblicazione in corso...');

        if (!post.image_url) {
          await sendMessage(chatId, `⚠️ Manca l'URL immagine per questo post.`);
          break;
        }

        const igPostId = await publishToInstagram({
          imageUrl: post.image_url,
          caption: post.caption,
          igUserId: client.ig_user_id,
          accessToken: client.ig_access_token,
        });

        await supabase
          .from('posts')
          .update({ status: 'published', ig_media_id: igPostId, published_at: new Date().toISOString() })
          .eq('id', postId);

        await sendMessage(chatId, `🚀 Pubblicato su Instagram! (ID: ${igPostId})`);
        break;
      }

      case 'reject_post': {
        const [postId] = params;
        await supabase.from('posts').update({ status: 'rejected' }).eq('id', postId);
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