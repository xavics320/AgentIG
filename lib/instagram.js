const GRAPH_API = 'https://graph.instagram.com/v21.0';

// Step 1: crea un "media container" puntando all'URL pubblico dell'immagine
export async function createMediaContainer({ imageUrl, caption, igUserId, accessToken }) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });

  const res = await fetch(`${GRAPH_API}/${igUserId}/media?${params}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) throw new Error(`IG container error: ${JSON.stringify(data.error)}`);
  return data.id;
}

// Step 2: pubblica il container creato
export async function publishMedia(creationId, { igUserId, accessToken }) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const res = await fetch(`${GRAPH_API}/${igUserId}/media_publish?${params}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) throw new Error(`IG publish error: ${JSON.stringify(data.error)}`);
  return data.id;
}

// Helper che fa i due step in sequenza, ora parametrizzato per cliente
export async function publishToInstagram({ imageUrl, caption, igUserId, accessToken }) {
  const creationId = await createMediaContainer({ imageUrl, caption, igUserId, accessToken });
  await new Promise((r) => setTimeout(r, 3000));
  return publishMedia(creationId, { igUserId, accessToken });
}