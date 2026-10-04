import { Record, CompanySettings } from '@/types';
import { formatDate, formatPrice } from '../formatters';
import { actMemoForRecord } from '../actMemo';
import { multiline, openPrintWindow, printStyles } from './shared';
import { buildMemoHtml, memoStyles, placeActMemo } from './actMemoLayout';
import { COMPLETION_ACT_ACCEPTANCE, COMPLETION_ACT_WARRANTY, fillWarrantyTerm } from './warranty';

// ─── Completion act (физлица) ─────────────────────────────────────────────────

function buildCompletionActHtml(
  record: Record,
  settings: CompanySettings | undefined,
  date: string,
  defects: string | null,
  recommendations: string | null,
  templateContent?: string,
): string {
  const docNum = record.documentNumber || record.id.slice(-8).toUpperCase();

  const companyName = settings?.name || '—';
  const executorLines = [
    companyName,
    settings?.taxId ? `УНП: ${settings.taxId}` : '',
    settings?.legalAddress ? `Юр. адрес: ${settings.legalAddress}` : '',
    settings?.actualAddress ? `Факт. адрес: ${settings.actualAddress}` : '',
    settings?.phone ? `Телефон: ${settings.phone}` : '',
  ].filter(Boolean).join('<br>');

  const clientName = record.isLegalEntity
    ? (record.legalCompanyName || record.client.name)
    : record.client.name;
  const clientPhone = record.isLegalEntity
    ? (record.legalPhone || record.client.phone)
    : record.client.phone;

  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const masterName = record.receptionist || record.serviceman || '';

  const blankLine = (label: string) =>
    `<div style="margin:6px 0;font-size:12px"><strong>${label}</strong> <span style="display:inline-block;border-bottom:1px solid #000;min-width:220px">&nbsp;</span></div>`;

  const field = (label: string, value: string | null) =>
    value
      ? `<div style="margin:6px 0;font-size:12px"><strong>${label}</strong> ${value}</div>`
      : blankLine(label);

  const dealEquipment = record.deal?.equipment || [];
  const equipmentBlock = dealEquipment.length > 0
    ? dealEquipment.map(de => `
        <div style="margin:6px 0 2px;font-size:12px">
          <strong>Модель модулей установленных в фары ТС</strong> — ${de.equipment.name}
        </div>
        ${de.equipment.warranty
          ? `<div style="margin:0 0 6px;font-size:12px">Гарантия от производителя на данные модули — ${de.equipment.warranty}</div>`
          : ''}
      `).join('')
    : '';

  // Только блоки памятки, относящиеся к услугам этой записи
  const memo = actMemoForRecord(record, settings);

  const defaultLegal = COMPLETION_ACT_WARRANTY + '\n\n' + COMPLETION_ACT_ACCEPTANCE;
  const legalHtml = fillWarrantyTerm(templateContent ?? defaultLegal, record.deal?.warranty)
    .split('\n')
    .map(line => line.trim() ? `<p style="margin-bottom:3px">${line}</p>` : '<br>')
    .join('');

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}${memoStyles}</head><body>

    <h1>Акт выполненных работ</h1>
    <p class="subtitle">№ ${docNum} от ${date}</p>

    <div class="two-col" style="margin:12px 0">
      <div>
        <div style="font-weight:700;margin-bottom:4px">Исполнитель:</div>
        <div style="font-size:11px;line-height:1.8">${executorLines}</div>
      </div>
      <div>
        <div style="font-weight:700;margin-bottom:4px">Заказчик:</div>
        <div style="font-size:12px;line-height:1.8">
          Собственник: ${clientName}<br>
          Телефон: ${clientPhone}
        </div>
      </div>
    </div>

    <h2>Транспортное средство (ТС)</h2>
    <table>
      <thead>
        <tr>
          <th>Марка, модель</th>
          <th>Гос. рег. знак</th>
          <th>Год выпуска</th>
          <th>Пробег</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${record.car.brand} ${record.car.model}</td>
          <td>${record.car.plateNumber || '—'}</td>
          <td>${record.car.year}</td>
          <td>${record.car.mileage || '—'}</td>
        </tr>
      </tbody>
    </table>

    <div style="margin:10px 0 4px;font-weight:700;font-size:12px">Перечень работ, которые Заказчик просил произвести:</div>
    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center">№</th>
          <th>Наименование работ / услуг</th>
          <th style="text-align:center;width:60px">Кол-во</th>
          <th style="text-align:right;width:90px">Цена, р.</th>
          <th style="text-align:right;width:90px">Сумма, р.</th>
        </tr>
      </thead>
      <tbody>
        ${record.items.map((item, i) => `
          <tr>
            <td style="text-align:center">${i + 1}</td>
            <td>${item.service.name}</td>
            <td style="text-align:center">${item.quantity}</td>
            <td style="text-align:right">${formatPrice(item.price)}</td>
            <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="total">Итоговая стоимость: ${formatPrice(total).replace(' р.', '')} бел. руб.</div>

    ${defects ? field('Обнаруженные недостатки:', multiline(defects)) : ''}
    ${recommendations ? field('Рекомендации:', multiline(recommendations)) : ''}
    ${equipmentBlock}

    <div style="margin-top:10px;font-size:12px;font-weight:700">Гарантийные обязательства:</div>
    <div class="legal-text" style="margin:4px 0 12px">${legalHtml}</div>

    ${memo ? `
      <div id="act-memo" class="memo">
        <div class="memo-heading">Памятка по эксплуатации</div>
        <div class="memo-body">${buildMemoHtml(memo)}</div>
      </div>
    ` : ''}

    <div style="font-size:11px;font-weight:700;margin-top:12px">
      Контроль полноты, качества работ, комплектность и проверку технического состояния автомобиля произвёл:
    </div>

    <div class="sig-section" style="margin-top:16px">
      <div class="sig-block">
        <div class="sig-title">Мастер-приёмщик</div>
        <div class="sig-line">&nbsp;</div>
        <div style="margin-top:4px;font-size:11px">${masterName}&nbsp;&nbsp;МП</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Заказчик/Представитель</div>
        <div class="sig-line">&nbsp;</div>
        <div style="margin-top:4px;font-size:11px">${clientName}</div>
      </div>
    </div>

  </body></html>`;
}

export function printCompletionAct(record: Record, settings?: CompanySettings, templateContent?: string): void {
  if (!record.deal) return;
  const html = buildCompletionActHtml(
    record, settings, formatDate(record.deal.closedAt),
    record.deal.defects || null, record.deal.recommendations || null, templateContent,
  );
  openPrintWindow(html, placeActMemo);
}

export function printBlankCompletionAct(record: Record, settings?: CompanySettings, templateContent?: string): void {
  const html = buildCompletionActHtml(
    record, settings, formatDate(record.scheduledAt), null, null, templateContent,
  );
  openPrintWindow(html, placeActMemo);
}
