import { Record } from '@/types';
import { formatDate, formatTime, formatPrice } from './formatters';

function openPrintWindow(html: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

const printStyles = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 13px; color: #000; padding: 20mm; }
    h1 { font-size: 18px; text-align: center; margin-bottom: 8px; }
    h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    .subtitle { text-align: center; color: #555; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; font-weight: 600; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { margin-bottom: 10px; }
    .label { font-size: 11px; color: #666; margin-bottom: 2px; }
    .value { font-size: 13px; font-weight: 500; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 20px; }
    .total { text-align: right; font-size: 15px; font-weight: bold; margin-top: 12px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .sig-line { border-top: 1px solid #000; padding-top: 4px; font-size: 11px; color: #555; }
    .note { font-size: 11px; color: #666; margin-top: 4px; font-style: italic; }
    @media print { body { padding: 10mm; } }
  </style>
`;

export function printWorkOrder(record: Record): void {
  const total = record.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const date = formatDate(record.scheduledAt);
  const time = formatTime(record.scheduledAt);

  const servicesRows = record.items.map(item => `
    <tr>
      <td>${item.service.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatPrice(item.price)}</td>
      <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang=ru><head><meta charset="UTF-8">${printStyles}</head><body>
    <h1>ЗАЯВКА НА ПРОВЕДЕНИЕ РАБОТ</h1>
    <p class="subtitle">№ ${record.id.slice(-8).toUpperCase()} от ${date}</p>

    <h2>Данные клиента</h2>
    <div class="two-col">
      <div class="field"><div class="label">ФИО</div><div class="value">${record.client.name}</div></div>
      <div class="field"><div class="label">Телефон</div><div class="value">${record.client.phone}</div></div>
    </div>

    <h2>Автомобиль</h2>
    <div class="two-col">
      <div class="field"><div class="label">Марка / Модель</div><div class="value">${record.car.brand} ${record.car.model}</div></div>
      <div class="field"><div class="label">Год / Гос. номер</div><div class="value">${record.car.year}${record.car.plateNumber ? ' / ' + record.car.plateNumber : ''}</div></div>
    </div>

    <h2>Запись</h2>
    <div class="two-col">
      <div class="field"><div class="label">Дата</div><div class="value">${date}</div></div>
      <div class="field"><div class="label">Время</div><div class="value">${time}</div></div>
    </div>
    <div class="field"><div class="label">Мастер-приёмщик</div><div class="value">${record.serviceman}</div></div>

    <h2>Перечень работ</h2>
    <table>
      <thead><tr><th>Услуга</th><th style="text-align:center">Кол-во</th><th style="text-align:right">Цена</th><th style="text-align:right">Сумма</th></tr></thead>
      <tbody>${servicesRows}</tbody>
    </table>
    <div class="total">Итого: ${formatPrice(total)}</div>

    <div class="signatures">
      <div>
        <div class="sig-line">Подпись клиента</div>
        <div class="note">Клиент ознакомлен с перечнем и стоимостью работ</div>
      </div>
      <div>
        <div class="sig-line">Исполнитель / Печать</div>
        <div class="note">Prime Auto Service</div>
      </div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}

export function printCompletionAct(record: Record): void {
  if (!record.deal) return;

  const date = formatDate(record.deal.closedAt);
  const equipmentList = record.deal.equipment.map(e => e.equipment.name).join(', ');

  const servicesRows = record.items.map(item => `
    <tr>
      <td>${item.service.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatPrice(item.price)}</td>
      <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}</head><body>
    <h1>АКТ ВЫПОЛНЕННЫХ РАБОТ</h1>
    <p class="subtitle">№ ${record.id.slice(-8).toUpperCase()} от ${date}</p>

    <h2>Данные клиента</h2>
    <div class="two-col">
      <div class="field"><div class="label">ФИО</div><div class="value">${record.client.name}</div></div>
      <div class="field"><div class="label">Телефон</div><div class="value">${record.client.phone}</div></div>
    </div>

    <h2>Автомобиль</h2>
    <div class="two-col">
      <div class="field"><div class="label">Марка / Модель</div><div class="value">${record.car.brand} ${record.car.model}</div></div>
      <div class="field"><div class="label">Год / Гос. номер</div><div class="value">${record.car.year}${record.car.plateNumber ? ' / ' + record.car.plateNumber : ''}</div></div>
    </div>

    <h2>Выполненные работы</h2>
    <table>
      <thead><tr><th>Услуга</th><th style="text-align:center">Кол-во</th><th style="text-align:right">Цена</th><th style="text-align:right">Сумма</th></tr></thead>
      <tbody>${servicesRows}</tbody>
    </table>
    <div class="total">Итого: ${formatPrice(record.deal.finalPrice)}</div>

    ${record.deal.priceIncreaseReason ? `<p class="note" style="margin-top:8px">Обоснование стоимости: ${record.deal.priceIncreaseReason}</p>` : ''}

    ${equipmentList ? `<h2>Установленное оборудование</h2><p>${equipmentList}</p>` : ''}

    ${record.deal.warranty ? `<h2>Гарантия</h2><p>${record.deal.warranty}</p>` : ''}

    <div class="signatures">
      <div>
        <div class="sig-line">Подпись клиента</div>
        <div class="note">Работы выполнены в полном объёме, претензий нет</div>
      </div>
      <div>
        <div class="sig-line">Исполнитель / Печать</div>
        <div class="note">Prime Auto Service</div>
      </div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}
