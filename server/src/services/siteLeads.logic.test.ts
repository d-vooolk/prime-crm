import { describe, expect, it } from 'vitest';
import { decodePhotoDataUrl, SITE_LEAD_MAX_PHOTO_BYTES } from './siteLeads.logic';

const jpegHead = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(60, 1)]);
const dataUrl = (buf: Buffer, type = 'image/jpeg') => `data:${type};base64,${buf.toString('base64')}`;

describe('decodePhotoDataUrl', () => {
  it('принимает JPEG и берёт расширение по содержимому', () => {
    const result = decodePhotoDataUrl(dataUrl(jpegHead, 'image/png'));
    expect(result?.ext).toBe('.jpg');
    expect(result?.buffer.equals(jpegHead)).toBe(true);
  });

  it('отклоняет не картинку под видом фото', () => {
    expect(decodePhotoDataUrl(dataUrl(Buffer.from('<html><script>alert(1)</script></html>')))).toBeNull();
  });

  it('отклоняет не data URL, другие типы и пустое', () => {
    expect(decodePhotoDataUrl('https://example.com/a.jpg')).toBeNull();
    expect(decodePhotoDataUrl(`data:text/html;base64,${jpegHead.toString('base64')}`)).toBeNull();
    expect(decodePhotoDataUrl('data:image/jpeg;base64,')).toBeNull();
  });

  it('отклоняет слишком большое фото', () => {
    const big = Buffer.concat([jpegHead, Buffer.alloc(SITE_LEAD_MAX_PHOTO_BYTES)]);
    expect(decodePhotoDataUrl(dataUrl(big))).toBeNull();
  });
});
