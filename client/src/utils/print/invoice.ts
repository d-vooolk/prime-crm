import { Record, CompanySettings } from '@/types';
import { formatDate, formatPrice } from '../formatters';
import { openPrintWindow } from './shared';
import { numberToRussianWords } from './numberToWords';
import { buildCustomerBlock, buildExecutorBlock, legalDocStyles, servicesTableRows } from './legalShared';

// ─── Счёт ─────────────────────────────────────────────────────────────────────

export function printInvoice(record: Record, settings?: CompanySettings): void {
  const date = formatDate(record.scheduledAt);
  const docNum = record.documentNumber || record.id.slice(-8).toUpperCase();
  const execName = record.executorSignatoryName || settings?.directorName || '';
  const repPosition = record.legalRepresentativePosition || '';
  const repName = record.legalRepresentative || '';
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalWords = numberToRussianWords(total);
  const vinPart = record.legalVin ? `, VIN: ${record.legalVin}` : '';
  const platePart = record.car.plateNumber ? `, г/н ${record.car.plateNumber}` : '';
  const car = `${record.car.brand} ${record.car.model} ${record.car.year}${vinPart}${platePart}`;

  const executorBlock = buildExecutorBlock(settings);
  const customerBlock = buildCustomerBlock(record);
  const customerSigLine = [repPosition, repName].filter(Boolean).join(' ');

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${legalDocStyles}</head><body>

    <div class="doc-title">Счёт ${docNum} от ${date}</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:12px 0 16px">
      <div class="req-block">
        <strong>Исполнитель:</strong><br>
        ${executorBlock}
      </div>
      <div class="req-block">
        ${customerBlock}
      </div>
    </div>

    <div style="text-align:center;font-weight:700;font-size:12px;margin:12px 0 6px">
      Счёт за ремонтные работы в автомобиле ${car}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:36px;text-align:center">№</th>
          <th>Наименование услуги</th>
          <th style="text-align:right;width:160px">Стоимость, в бел. руб.</th>
        </tr>
      </thead>
      <tbody>
        ${servicesTableRows(record)}
        <tr class="total-row">
          <td colspan="2" style="text-align:right">Итого по счёту</td>
          <td style="text-align:right">${formatPrice(total).replace(' р.', '')} бел. руб. (Без НДС)</td>
        </tr>
      </tbody>
    </table>

    <p style="margin:14px 0;text-align:justify;font-size:11px">
      Настоящий счёт подтверждает факт оказания услуг по договору №${docNum} от ${date}г. и служит основанием
      для зачисления суммы в размере ${formatPrice(total).replace(' р.', '')} бел. руб. (${totalWords}) белорусских рублей. (Без НДС)
    </p>
    <p style="font-size:11px;margin-bottom:16px">
      <strong>Итого, сумма:</strong> ${formatPrice(total).replace(' р.', '')} бел. руб. (${totalWords}) белорусских рублей (Без НДС)
    </p>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-top:28px">
      <div style="flex:1;font-size:11px">
        Исполнитель ______________________________<br>
        <br>
        ${execName ? `${execName}&nbsp;&nbsp;&nbsp;&nbsp;МП` : 'МП'}
      </div>
      <div style="flex:1;font-size:11px">
        Заказчик ______________________________<br>
        <br>
        ${customerSigLine ? `${customerSigLine}&nbsp;&nbsp;&nbsp;&nbsp;МП` : 'МП'}
      </div>
    </div>

  </body></html>`;

  openPrintWindow(html);
}

