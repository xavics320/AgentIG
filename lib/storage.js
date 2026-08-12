import { supabase } from './supabase.js';

// Carica un'immagine (in formato base64) sul bucket "post-images" di Supabase Storage
// e restituisce l'URL pubblico, necessario a Instagram per poterla leggere.
export async function uploadImage(base64Data, filename) {
  // Buffer.from converte la stringa base64 nei byte grezzi dell'immagine:
  // e' il formato che l'API di Supabase Storage si aspetta per l'upload.
  const buffer = Buffer.from(base64Data, 'base64');

  const { error } = await supabase.storage
    .from('post-images')
    .upload(filename, buffer, {
      contentType: 'image/png',
      upsert: true, // sovrascrive se esiste gia' un file con lo stesso nome
    });

  if (error) {
    throw new Error(`Errore upload storage: ${error.message}`);
  }

  const { data } = supabase.storage.from('post-images').getPublicUrl(filename);
  return data.publicUrl;
}