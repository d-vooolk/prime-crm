import { Record, CompanySettings } from '@/types';
import { formatDate, formatPrice } from '../formatters';
import { openPrintWindow } from './shared';
import { numberToRussianWords } from './numberToWords';
import { buildCustomerBlock, buildExecutorBlock, legalDocStyles, servicesTableRows } from './legalShared';

// ─── Акт для юр. лиц ─────────────────────────────────────────────────────────

export function printLegalAct(record: Record, settings?: CompanySettings): void {
  const date = record.deal ? formatDate(record.deal.closedAt) : formatDate(record.scheduledAt);
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

    <div class="doc-title">Акт № ${docNum} от ${date}</div>
    <div style="text-align:center;font-size:12px;margin-bottom:14px">о приемке выполненных работ<br>(оказанных услуг)</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:12px 0 16px">
      <div class="req-block">
        <strong>Исполнитель:</strong><br>
        ${executorBlock}
      </div>
      <div class="req-block">
        ${customerBlock}
      </div>
    </div>

    <div style="font-size:11px;margin-bottom:6px">
      Автомобиль: <strong>${car}</strong>
    </div>

    <p style="font-size:11px;margin-bottom:8px">
      Настоящий акт составлен к Договору № ${docNum} на оказание услуг от ${date}г.
    </p>

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

    <p style="margin:14px 0;font-size:11px">
      Всего оказано услуг на сумму ${formatPrice(total).replace(' р.', '')} бел. руб. (${totalWords} белорусских рублей) (Без НДС)
    </p>
    <p style="margin-bottom:28px;font-size:11px;text-align:justify">
      Вышеперечисленные работы (услуги) выполнены полностью и в срок. Заказчик претензий по объему, качеству и срокам оказания услуг претензий не имеет.
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
