import sharp from 'sharp';

// Prende l'immagine generata dall'AI (base64) e ci sovrappone il logo fisso,
// scaricato una sola volta dal suo URL pubblico su Supabase Storage.
// Restituisce il buffer dell'immagine finale, pronta per l'upload.
export async function applyLogo(baseImageBase64) {
  const baseBuffer = Buffer.from(baseImageBase64, 'base64');

  const logoRes = await fetch(process.env.LOGO_URL);
  if (!logoRes.ok) throw new Error(`Impossibile scaricare il logo: ${logoRes.status}`);
  const logoBuffer = Buffer.from(await logoRes.arrayBuffer());

  // Ridimensiona il logo a una larghezza fissa (circa 1/5 della larghezza base)
  // mantenendo le proporzioni originali
  const resizedLogo = await sharp(logoBuffer)
    .resize({ width: 220 })
    .toBuffer();

  // gravity da solo posizionerebbe il logo attaccato al bordo, senza margine.
  // Calcoliamo quindi manualmente le coordinate per lasciare 32px di margine
  // dal bordo destro e inferiore dell'immagine base.
  const baseMeta = await sharp(baseBuffer).metadata();
  const logoMeta = await sharp(resizedLogo).metadata();
  const margin = 32;
  const left = baseMeta.width - logoMeta.width - margin;
  const top = baseMeta.height - logoMeta.height - margin;

  const finalImage = await sharp(baseBuffer)
    .composite([{ input: resizedLogo, left, top }])
    .png()
    .toBuffer();

  return finalImage;
}