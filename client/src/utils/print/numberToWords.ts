/** Сумма прописью для договоров и счетов: целая часть, «тысяча» — женского рода */
export function numberToRussianWords(n: number): string {
  const ones  = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const onesF = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
    'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tensArr = ['', 'десять', 'двадцать', 'тридцать', 'сорок', 'пятьдесят',
    'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот',
    'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

  function chunk(num: number, feminine: boolean): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const o = num % 10;
    const parts: string[] = [];
    if (h) parts.push(hundreds[h]);
    if (t === 1) { parts.push(teens[o]); }
    else {
      if (t) parts.push(tensArr[t]);
      if (o) parts.push(feminine ? onesF[o] : ones[o]);
    }
    return parts.join(' ');
  }

  function thousandForm(n: number): string {
    const o = n % 10, t = n % 100;
    if (t >= 11 && t <= 19) return 'тысяч';
    if (o === 1) return 'тысяча';
    if (o >= 2 && o <= 4) return 'тысячи';
    return 'тысяч';
  }

  const int = Math.floor(n);
  if (int === 0) return 'ноль';
  const parts: string[] = [];
  const thousands = Math.floor(int / 1000);
  const remainder = int % 1000;
  if (thousands) { parts.push(chunk(thousands, true)); parts.push(thousandForm(thousands)); }
  if (remainder) parts.push(chunk(remainder, false));
  return parts.join(' ');
}
