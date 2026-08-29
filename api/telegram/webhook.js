import { supabase } from '../../lib/supabase.js';
import { answerCallbackQuery, sendMessage, sendPhoto } from '../../lib/telegram.js';
import { publishToInstagram } from '../../lib/instagram.js';
import { generatePostAssets } from '../../lib/postGenerator.js';

export default async function handler(req, res) {
  const update = req.body;

  // Telegram manda tipi diversi di update nello stesso webhook:
  // "callback_query" per i click sui bottoni, "message" per il testo libero.
  // Le gestiamo in due rami separati.
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
  } else if (update.message?.text) {
    await handleTextMessage(update.message);
  }

  return res.status(200).end();
}

async function handleCallbackQuery(callback) {
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

        // Invece di scartare subito, apriamo una "sessione" che aspetta
        // il prossimo messaggio di testo con il feedback dell'utente.
        await supabase.from('posts').update({ status: 'needs_feedback' }).eq('id', postId);

        await supabase.from('telegram_sessions').insert({
          chat_id: String(chatId),
          pending_action: 'regenerate_post',
          reference_id: postId,
        });

        await answerCallbackQuery(callback.id, 'Ok, dimmi cosa cambiare');
        await sendMessage(chatId, `✏️ Cosa vuoi cambiare in questo post? Scrivimi in un messaggio libero (es. "rendi la caption più breve" o "usa un tono più informale").`);
        break;
      }

      default:
        await answerCallbackQuery(callback.id);
    }
  } catch (err) {
    await answerCallbackQuery(callback.id, 'Errore ⚠️');
    await sendMessage(chatId, `Errore durante l'operazione: ${err.message}`);
  }
}

async function handleTextMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;

  // Cerca una sessione in sospeso per questa chat: se non c'e', il messaggio
  // e' solo una chiacchiera libera e lo ignoriamo (nessuna sessione attiva
  // a cui collegarlo).
  const { data: session } = await supabase
    .from('telegram_sessions')
    .select('*')
    .eq('chat_id', String(chatId))
    .eq('pending_action', 'regenerate_post')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return;

  const postId = session.reference_id;

  try {
    const { data: post } = await supabase
      .from('posts')
      .select('*, calendar_id')
      .eq('id', postId)
      .single();

    const { data: calendarEntry } = await supabase
      .from('content_calendar')
      .select('*, clients(*)')
      .eq('id', post.calendar_id)
      .single();

    const client = calendarEntry.clients;

    await sendMessage(chatId, `🔄 Rigenero il post con le tue indicazioni, un momento...`);

    const { caption, imagePrompt, imageUrl } = await generatePostAssets({
      client,
      contentType: calendarEntry.content_type,
      topicSummary: calendarEntry.topic_summary,
      extraInstructions: text, // il feedback dell'utente
    });

    await supabase
      .from('posts')
      .update({ caption, image_prompt: imagePrompt, image_url: imageUrl, status: 'pending' })
      .eq('id', postId);

    // La sessione e' "consumata": la cancelliamo cosi' un messaggio
    // successivo non viene interpretato come feedback per questo stesso post
    await supabase.from('telegram_sessions').delete().eq('id', session.id);

    await sendPhoto(
      chatId,
      imageUrl,
      `✍️ *Nuova versione*\n\n${caption}`,
      [
        { text: '✅ Approva', callback_data: `approve_post:${postId}` },
        { text: '❌ Rigenera', callback_data: `reject_post:${postId}` },
      ]
    );
  } catch (err) {
    console.error('Errore durante la rigenerazione:', err.message);
    await sendMessage(chatId, `Errore durante la rigenerazione: ${err.message}`);
  }
}