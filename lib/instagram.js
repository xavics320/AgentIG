const GRAPH_API = 'https://graph.facebook.com/v21.0';
const IG_USER_ID = process.env.IG_USER_ID; // ID dell'account Instagram Business
const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN; // long-lived token della tua app Meta

// Step 1: crea un "media container" puntando all'URL pubblico dell'immagine
export async function createMediaContainer({ imageUrl, caption }) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: ACCESS_TOKEN,
  });

  const res = await fetch(`${GRAPH_API}/${IG_USER_ID}/media?${params}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) throw new Error(`IG container error: ${JSON.stringify(data.error)}`);
  return data.id; // creation_id, serve per lo step 2
}

// Step 2: pubblica il container creato
export async function publishMedia(creationId) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: ACCESS_TOKEN,
  });

  const res = await fetch(`${GRAPH_API}/${IG_USER_ID}/media_publish?${params}`, {
    method: 'POST',
  });
  const data = await res.json();
  if (data.error) throw new Error(`IG publish error: ${JSON.stringify(data.error)}`);
  return data.id; // ID del post pubblicato
}

// Helper che fa i due step in sequenza
export async function publishToInstagram({ imageUrl, caption }) {
  const creationId = await createMediaContainer({ imageUrl, caption });
  // Instagram consiglia una piccola attesa prima del publish per dare tempo al container di processare
  await new Promise((r) => setTimeout(r, 3000));
  return publishMedia(creationId);
}
