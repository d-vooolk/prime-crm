import { describe, expect, it } from 'vitest';
import { appendProposalText } from '../services/wikiProposals.logic';

describe('appendProposalText', () => {
  it('пустой раздел — только блок оптовика', () => {
    expect(appendProposalText('', '  Снять бампер.  ')).toBe('Снять бампер.');
  });

  it('дописывает через пустую строку, убирая хвостовые пробелы', () => {
    expect(appendProposalText('Фара на 4 болтах.\n\n', 'Корректор — сзади.')).toBe('Фара на 4 болтах.\n\nКорректор — сзади.');
  });

  it('пустой блок текст не меняет', () => {
    expect(appendProposalText('Текст  \n', '   ')).toBe('Текст  \n');
  });

  it('переводы строк Windows приводит к \\n', () => {
    expect(appendProposalText('А', 'Б\r\nВ')).toBe('А\n\nБ\nВ');
  });
});
