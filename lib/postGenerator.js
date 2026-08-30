import { generatePostContent } from './claude.js';
import { generateImage } from './imageGen.js';
import { applyLogo } from './branding.js';
import { uploadImage } from './storage.js';

// Genera caption + immagine (con logo applicato) e la carica su storage.
// extraInstructions e' opzionale: quando presente (es. feedback dell'utente
// dopo un "Rigenera"), viene aggiunto come istruzione extra per Claude,
// cosi' la nuova versione tiene conto di cosa non andava nella precedente.
export async function generatePostAssets({ client, contentType, topicSummary, extraInstructions }) {
  const effectiveTopic = extraInstructions
    ? `${topicSummary}\n\nISTRUZIONI AGGIUNTIVE DA PARTE DEL CLIENTE (tienile in forte considerazione, sono un correttivo rispetto a un tentativo precedente non approvato): ${extraInstructions}`
    : topicSummary;

  const content = await generatePostContent({
    contentType,
    topicSummary: effectiveTopic,
    brand: client.brand_description,
    style: {
      bgColor: client.style_bg_color,
      textColor: client.style_text_color,
      accentColor: client.style_accent_color,
      visual: client.style_visual,
    },
  });

  const imageBase64 = await generateImage(content.image_prompt);
  const finalImageBuffer = await applyLogo(imageBase64, client.logo_url);

  const filename = `post-${client.id}-${Date.now()}.png`;
  const imageUrl = await uploadImage(finalImageBuffer, filename);

  return {
    caption: content.caption,
    imagePrompt: content.image_prompt,
    imageUrl,
  };
}