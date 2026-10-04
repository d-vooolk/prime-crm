import { describe, it, expect } from 'vitest';
import { sniffMedia, mediaKind } from '../utils/uploads';

const pad = (bytes: number[] | Buffer, size = 32) => {
  const b = Buffer.alloc(size);
  Buffer.from(bytes).copy(b);
  return b;
};
const ascii = (s: string) => Buffer.from(s, 'latin1');

describe('sniffMedia — формат по содержимому', () => {
  it('распознаёт фото', () => {
    expect(sniffMedia(pad([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ kind: 'photo', ext: '.jpg' });
    expect(sniffMedia(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ kind: 'photo', ext: '.png' });
    expect(sniffMedia(pad(ascii('GIF89a')))).toEqual({ kind: 'photo', ext: '.gif' });
    expect(sniffMedia(pad(Buffer.concat([ascii('RIFF'), Buffer.alloc(4), ascii('WEBP')])))).toEqual({ kind: 'photo', ext: '.webp' });
    expect(sniffMedia(pad(Buffer.concat([Buffer.alloc(4), ascii('ftypheic')])))).toEqual({ kind: 'photo', ext: '.heic' });
  });

  it('распознаёт видео', () => {
    expect(sniffMedia(pad(Buffer.concat([Buffer.alloc(4), ascii('ftypisom')])))).toEqual({ kind: 'video', ext: '.mp4' });
    expect(sniffMedia(pad(Buffer.concat([Buffer.alloc(4), ascii('ftypqt  ')])))).toEqual({ kind: 'video', ext: '.mov' });
    expect(sniffMedia(pad([0x1a, 0x45, 0xdf, 0xa3]))?.kind).toBe('video');
  });

  it('отклоняет HTML, SVG и скрипты под видом фото', () => {
    expect(sniffMedia(pad(ascii('<!DOCTYPE html><script>')))).toBeNull();
    expect(sniffMedia(pad(ascii('<svg xmlns="http://www.w3.org/2000/svg">')))).toBeNull();
    expect(sniffMedia(pad(ascii('alert(document.cookie)')))).toBeNull();
    expect(sniffMedia(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('mediaKind — предварительная проверка по имени', () => {
  it('пропускает фото и видео, отклоняет остальное', () => {
    expect(mediaKind({ originalname: 'IMG_1.HEIC', mimetype: 'application/octet-stream' })).toBe('photo');
    expect(mediaKind({ originalname: 'clip.mov', mimetype: 'video/quicktime' })).toBe('video');
    expect(mediaKind({ originalname: 'evil.html', mimetype: 'image/jpeg' })).toBeNull();
    expect(mediaKind({ originalname: 'x.svg', mimetype: 'image/svg+xml' })).toBeNull();
    expect(mediaKind({ originalname: 'blob', mimetype: 'image/jpeg' })).toBe('photo');
  });
});
