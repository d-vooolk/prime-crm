import { describe, it, expect } from 'vitest';
import { makePreview, safeContentType, isViewableType, clip, pickNewUids } from '../utils/mail';
import { isMailAttachmentPath } from '../utils/uploads';

describe('почта — превью письма', () => {
  it('склеивает строки и убирает цитаты', () => {
    expect(makePreview('Здравствуйте!\n\n> старое письмо\nЗапишите на   пятницу')).toBe('Здравствуйте! Запишите на пятницу');
  });

  it('обрезает длинный текст', () => {
    const preview = makePreview('а'.repeat(500), 20)!;
    expect(preview).toHaveLength(20);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('пустой текст — null', () => {
    expect(makePreview('')).toBeNull();
    expect(makePreview('> только цитата')).toBeNull();
    expect(makePreview(undefined)).toBeNull();
  });
});

describe('почта — типы вложений', () => {
  it('картинки и PDF можно открыть, остальное — только скачать', () => {
    expect(safeContentType('image/png')).toBe('image/png');
    expect(safeContentType('application/pdf; name="a.pdf"')).toBe('application/pdf');
    expect(safeContentType('text/html')).toBe('application/octet-stream');
    expect(safeContentType('image/svg+xml')).toBe('application/octet-stream');
    expect(safeContentType(undefined)).toBe('application/octet-stream');
    expect(isViewableType('IMAGE/JPEG')).toBe(true);
    expect(isViewableType('application/zip')).toBe(false);
  });

  it('clip обрезает и чистит пустое', () => {
    expect(clip('  abc  ', 2)).toBe('ab');
    expect(clip('   ', 10)).toBeNull();
    expect(clip(null, 10)).toBeNull();
  });
});

describe('почта — какие письма забирать', () => {
  it('отбрасывает уже забранные и сортирует', () => {
    expect(pickNewUids([12, 10, 11, 9], 10, 100)).toEqual([11, 12]);
  });

  it('«N:*» вернул только старое последнее письмо — забирать нечего', () => {
    expect(pickNewUids([10], 10, 100)).toEqual([]);
  });

  it('при переполнении берёт самые свежие', () => {
    expect(pickNewUids([1, 2, 3, 4, 5], 0, 2)).toEqual([4, 5]);
  });
});

describe('вложения писем не раздаются статикой', () => {
  it('ловит обходы через кодирование и пути', () => {
    expect(isMailAttachmentPath('/mail/a.bin')).toBe(true);
    expect(isMailAttachmentPath('/%6Dail/a.bin')).toBe(true);
    expect(isMailAttachmentPath('//mail/a.bin')).toBe(true);
    expect(isMailAttachmentPath('/wiki/../mail/a.bin')).toBe(true);
    expect(isMailAttachmentPath('/MAIL/a.bin')).toBe(true);
    expect(isMailAttachmentPath('/mail%2Fa.bin')).toBe(true);
    expect(isMailAttachmentPath('/%E0%A4%A')).toBe(true);
  });

  it('остальные загрузки отдаются', () => {
    expect(isMailAttachmentPath('/wiki/photo.jpg')).toBe(false);
    expect(isMailAttachmentPath('/repair-types/rt-1.webp')).toBe(false);
    expect(isMailAttachmentPath('/mailbox.jpg')).toBe(false);
  });
});
