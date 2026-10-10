import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { buildMailSrcDoc, formatMailDate, formatSize, senderLabel } from './mail.utils';

describe('почта — форматирование', () => {
  const now = dayjs('2026-10-11T15:00:00');

  it('дата: сегодня — время, в этом году — день и месяц, раньше — полная', () => {
    expect(formatMailDate('2026-10-11T09:05:00', now)).toBe('09:05');
    expect(formatMailDate('2025-03-01T09:05:00', now)).toBe('01.03.2025');
    expect(formatMailDate('2026-02-03T09:05:00', now)).toMatch(/^3 /);
  });

  it('размер вложения', () => {
    expect(formatSize(500)).toBe('500 Б');
    expect(formatSize(2048)).toBe('2 КБ');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 МБ');
  });

  it('отправитель: имя, адрес или заглушка', () => {
    expect(senderLabel({ fromName: 'Иван', fromAddress: 'i@x.by' })).toBe('Иван');
    expect(senderLabel({ fromName: null, fromAddress: 'i@x.by' })).toBe('i@x.by');
    expect(senderLabel({ fromName: null, fromAddress: null })).toBe('Без отправителя');
  });

  it('HTML письма — с CSP без скриптов', () => {
    const doc = buildMailSrcDoc('<p>Привет</p>');
    expect(doc).toContain("default-src 'none'");
    expect(doc).not.toContain('script-src');
    expect(doc).toContain('<p>Привет</p>');
  });
});
