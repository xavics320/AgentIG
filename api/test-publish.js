import { supabase } from '../lib/supabase.js';
import { publishToInstagram } from '../lib/instagram.js';

// Endpoint di solo test: GET /api/test-publish?postId=<uuid>
// Prende un post gia' presente nella tabella posts e lo pubblica su Instagram,
// senza passare dal flusso Telegram. Utile per isolare ed eseguire il debug
// della sola integrazione con Instagram Graph API.
export default async function handler(req, res) {
  const { postId } = req.query;

  if (!postId) {
    return res.status(400).json({ error: 'Manca il parametro postId nell\'URL, es. ?postId=abc-123' });
  }

  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .single();

  if (fetchError || !post) {
    return res.status(404).json({ error: 'Post non trovato', details: fetchError });
  }

  if (!post.image_url) {
    return res.status(400).json({ error: 'Questo post non ha un image_url, impossibile pubblicare' });
  }

  try {
    const igMediaId = await publishToInstagram({
      imageUrl: post.image_url,
      caption: post.caption ?? '',
    });

    await supabase
      .from('posts')
      .update({
        status: 'published',
        ig_media_id: igMediaId,
        published_at: new Date().toISOString(),
      })
      .eq('id', postId);

    return res.status(200).json({ success: true, igMediaId });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}