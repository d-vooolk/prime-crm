import { sniffMedia } from '../utils/uploads';

/** Фото к заявке: сайт сжимает их до 1280 px (~200 КБ), запас — на всякий случай */
export const SITE_LEAD_MAX_PHOTOS = 3;
export const SITE_LEAD_MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Фото из формы сайта приходят data URL (data:image/jpeg;base64,…). Формат проверяется по
 * содержимому, а не по заявленному типу: не фото, пусто или слишком большое — null
 */
export function decodePhotoDataUrl(dataUrl: string): { buffer: Buffer; ext: string } | null {
  const match = /^data:image\/[\w.+-]+;base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length === 0 || buffer.length > SITE_LEAD_MAX_PHOTO_BYTES) return null;
  const detected = sniffMedia(buffer.subarray(0, 64));
  if (!detected || detected.kind !== 'photo') return null;
  return { buffer, ext: detected.ext };
}
