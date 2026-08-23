const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.content.find((b) => b.type === 'text')?.text ?? '';
}

// Genera la proposta settimanale: 3 post con tipo di contenuto e data
export async function generateWeeklyPlan({ weekStart, brand }) {
  const system = `Sei uno strategist di contenuti Instagram per un brand di sviluppo web freelance.
Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown.`;

  const user = `Genera una proposta di calendario per 3 post Instagram per la settimana che inizia ${weekStart}.
Brand: ${brand}.
Varia i tipi di contenuto (es: dietro le quinte di un progetto, tip tecnico/CSS-React, showcase di un lavoro finito, processo creativo).
Rispondi con questo schema JSON:
[
  { "post_date": "YYYY-MM-DD", "content_type": "...", "topic_summary": "breve descrizione (1-2 frasi)" }
]`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}

// Identita' visiva fissa del brand: viene sempre aggiunta alla descrizione
// dell'immagine, cosi' ogni post segue la stessa palette e lo stesso mood
const STYLE_GUIDE = `Stile visivo obbligatorio: sfondo scuro (nero o grigio molto scuro),
elementi testuali o decorativi in bianco, dettagli e accenti in verde lime brillante
(colore esadecimale #C8FF00). Estetica moderna, minimale, tech/dev, linee pulite,
niente elementi fotorealistici di persone. Il tono generale deve richiamare un brand
di sviluppo software: geometrico, essenziale, leggibile anche in miniatura.`;

// Genera il contenuto vero e proprio (caption + prompt immagine) per un singolo post
export async function generatePostContent({ contentType, topicSummary, brand }) {
  const system = `Sei un copywriter Instagram per un brand di sviluppo web freelance italiano.
Tono: professionale ma accessibile, mai sopra le righe. Rispondi SOLO con JSON valido.`;

  const user = `Crea il contenuto per un post Instagram.
Brand: ${brand}
Tipo di contenuto: ${contentType}
Tema: ${topicSummary}

${STYLE_GUIDE}

Rispondi con questo schema JSON:
{
  "caption": "caption pronta per la pubblicazione, con eventuali hashtag pertinenti",
  "image_prompt": "descrizione dettagliata dell'immagine da generare, che DEVE includere esplicitamente lo stile visivo sopra indicato (sfondo scuro, bianco, verde lime #C8FF00)"
}`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw.replace(/```json|```/g, '').trim());
}