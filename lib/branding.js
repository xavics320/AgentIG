import sharp from 'sharp';

export async function applyLogo(baseImageBase64, logoUrl) {
  const baseBuffer = Buffer.from(baseImageBase64, 'base64');

  const logoRes = await fetch(logoUrl);
  if (!logoRes.ok) throw new Error(`Impossibile scaricare il logo: ${logoRes.status}`);
  const logoBuffer = Buffer.from(await logoRes.arrayBuffer());

  // Chroma-key: rende trasparenti i pixel scuri del logo (vedi spiegazione
  // gia' data in precedenza). Se il logo e' gia' un PNG con trasparenza,
  // questo passaggio non modifica nulla di visibile.
  const { data, info } = await sharp(logoBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const threshold = 40;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r < threshold && g < threshold && b < threshold) {
      data[i + 3] = 0;
    }
  }

  const transparentLogo = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .png()
    .toBuffer();

  const resizedLogo = await sharp(transparentLogo)
    .resize({ width: 220 })
    .toBuffer();

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