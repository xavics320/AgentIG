const OPENAI_API_URL = 'https://api.openai.com/v1/images/generations';

// Genera un'immagine a partire da un prompt testuale.
// Restituisce i dati dell'immagine codificati in base64 (stringa di testo
// che rappresenta i byte dell'immagine), pronti per essere caricati altrove.
export async function generateImage(prompt) {
  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024', // formato quadrato, ideale per il feed Instagram
      response_format: 'b64_json',
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI image error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data[0].b64_json;
}