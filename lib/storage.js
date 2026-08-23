import { supabase } from './supabase.js';

// Carica un'immagine (gia' come buffer di byte) sul bucket "post-images" di
// Supabase Storage e restituisce l'URL pubblico, necessario a Instagram per poterla leggere.
export async function uploadImage(imageBuffer, filename) {
  const { error } = await supabase.storage
    .from('post-images')
    .upload(filename, imageBuffer, {
      contentType: 'image/png',
      upsert: true, // sovrascrive se esiste gia' un file con lo stesso nome
    });

  if (error) {
    throw new Error(`Errore upload storage: ${error.message}`);
  }

  const { data } = supabase.storage.from('post-images').getPublicUrl(filename);
  return data.publicUrl;
}