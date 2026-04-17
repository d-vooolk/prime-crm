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
    .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
    .field { margin-bottom: 10px; }
    .label { font-size: 11px; color: #666; margin-bottom: 2px; }
    .value { font-size: 13px; font-weight: 500; border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 20px; }
    .total { text-align: right; font-size: 15px; font-weight: bold; margin-top: 12px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .sig-line { border-top: 1px solid #000; padding-top: 4px; font-size: 11px; color: #555; }
    .note { font-size: 11px; color: #666; margin-top: 4px; font-style: italic; }
    .contract-text { font-size: 12px; line-height: 1.7; margin: 8px 0; }
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
      <div class="field"><div class="label">Год</div><div class="value">${record.car.year}</div></div>
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
      <div class="field"><div class="label">Год</div><div class="value">${record.car.year}</div></div>
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

export function printBlankCompletionAct(record: Record): void {
  const date = formatDate(record.scheduledAt);
  const docNum = record.id.slice(-8).toUpperCase();

  const servicesRows = record.items.map((item, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${item.service.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatPrice(item.price)}</td>
      <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const total = record.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const clientName = record.isLegalEntity ? (record.legalCompanyName || record.client.name) : record.client.name;

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}</head><body>
    <h1>АКТ ВЫПОЛНЕННЫХ РАБОТ</h1>
    <p class="subtitle">№ ${docNum} от ${date}</p>

    <h2>Данные клиента</h2>
    <div class="two-col">
      <div class="field"><div class="label">${record.isLegalEntity ? 'Организация' : 'ФИО'}</div><div class="value">${clientName}</div></div>
      <div class="field"><div class="label">Телефон</div><div class="value">${record.isLegalEntity ? (record.legalPhone || record.client.phone) : record.client.phone}</div></div>
    </div>

    <h2>Автомобиль</h2>
    <div class="two-col">
      <div class="field"><div class="label">Марка / Модель</div><div class="value">${record.car.brand} ${record.car.model}</div></div>
      <div class="field"><div class="label">Год</div><div class="value">${record.car.year}</div></div>
    </div>

    <h2>Выполненные работы</h2>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">№</th>
          <th>Наименование услуги</th>
          <th style="text-align:center">Кол-во</th>
          <th style="text-align:right">Цена</th>
          <th style="text-align:right">Сумма</th>
        </tr>
      </thead>
      <tbody>${servicesRows}</tbody>
    </table>
    <div class="total">Итого: ${formatPrice(total)}</div>

    <div class="field" style="margin-top:16px">
      <div class="label">Гарантия</div>
      <div class="value">&nbsp;</div>
    </div>

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

export function printServiceContract(record: Record): void {
  const date = formatDate(record.scheduledAt);
  const docNum = record.id.slice(-8).toUpperCase();
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const servicesRows = record.items.map((item, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${item.service.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatPrice(item.price)}</td>
      <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const clientName = record.isLegalEntity
    ? (record.legalCompanyName || record.client.name)
    : record.client.name;
  const representative = record.isLegalEntity ? record.client.name : '';
  const unp = record.isLegalEntity ? record.legalUnp || '' : '';
  const address = record.isLegalEntity ? record.legalAddress || '' : '';
  const phone = record.isLegalEntity ? (record.legalPhone || record.client.phone) : record.client.phone;
  const bankDetails = record.isLegalEntity ? record.legalBankDetails || '' : '';
  const bic = record.isLegalEntity ? record.legalBic || '' : '';

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}</head><body>
    <h1>ДОГОВОР ОКАЗАНИЯ УСЛУГ</h1>
    <p class="subtitle">№ ${docNum} от ${date}</p>

    <div class="two-col" style="margin-bottom: 16px;">
      <div>
        <strong>Исполнитель:</strong><br>
        <span class="contract-text">Prime Auto Service<br>
        г. Минск<br>
        Тел.: _______________</span>
      </div>
      <div>
        <strong>Заказчик:</strong><br>
        <span class="contract-text">
          ${clientName}<br>
          ${representative ? `в лице: ${representative}<br>` : ''}
          ${unp ? `УНП: ${unp}<br>` : ''}
          ${address ? `Адрес: ${address}<br>` : ''}
          Тел.: ${phone}
        </span>
      </div>
    </div>

    <p class="contract-text">
      Исполнитель обязуется по заданию Заказчика оказать услуги, указанные в настоящем договоре,
      а Заказчик обязуется оплатить эти услуги на условиях настоящего договора.
    </p>

    <h2>1. Предмет договора</h2>
    <p class="contract-text">
      Исполнитель оказывает следующие услуги для автомобиля
      <strong>${record.car.brand} ${record.car.model} ${record.car.year}</strong>:
    </p>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">№</th>
          <th>Наименование услуги</th>
          <th style="text-align:center">Кол-во</th>
          <th style="text-align:right">Цена</th>
          <th style="text-align:right">Сумма</th>
        </tr>
      </thead>
      <tbody>${servicesRows}</tbody>
    </table>
    <div class="total">Общая стоимость: ${formatPrice(total)}</div>

    <h2>2. Стоимость и порядок оплаты</h2>
    <p class="contract-text">
      Общая стоимость услуг составляет <strong>${formatPrice(total)}</strong>.
      Оплата производится в полном объёме после выполнения работ.
    </p>

    <h2>3. Сроки оказания услуг</h2>
    <p class="contract-text">
      Дата выполнения работ: <strong>${date}</strong>.
    </p>

    <h2>4. Гарантии</h2>
    <p class="contract-text">
      ${record.deal?.warranty
        ? `Гарантийный срок: ${record.deal.warranty}.`
        : 'Гарантийный срок: ________________________________.'}
    </p>

    <h2>5. Реквизиты и подписи сторон</h2>
    <div class="two-col">
      <div>
        <strong>Исполнитель:</strong>
        ${bankDetails ? `<p class="contract-text" style="white-space:pre-wrap">${bankDetails}</p>` : '<p class="contract-text">р/с: _______________<br>Банк: _______________<br>БИК: _______________</p>'}
      </div>
      <div>
        <strong>Заказчик:</strong>
        <p class="contract-text">
          ${clientName}<br>
          ${bankDetails ? `<span style="white-space:pre-wrap">${bankDetails}</span>` : ''}
          ${bic ? `БИК: ${bic}<br>` : ''}
        </p>
      </div>
    </div>

    <div class="signatures">
      <div>
        <div class="sig-line">Подпись Заказчика / МП</div>
        <div class="note">${clientName}</div>
      </div>
      <div>
        <div class="sig-line">Подпись Исполнителя / МП</div>
        <div class="note">Prime Auto Service</div>
      </div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}

export function printInvoice(record: Record): void {
  const date = formatDate(record.scheduledAt);
  const docNum = record.id.slice(-8).toUpperCase();
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const servicesRows = record.items.map((item, idx) => `
    <tr>
      <td style="text-align:center">${idx + 1}</td>
      <td>${item.service.name}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${formatPrice(item.price)}</td>
      <td style="text-align:right">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');

  const clientName = record.isLegalEntity
    ? (record.legalCompanyName || record.client.name)
    : record.client.name;
  const unp = record.isLegalEntity ? record.legalUnp || '' : '';
  const address = record.isLegalEntity ? record.legalAddress || '' : '';
  const bankDetails = record.isLegalEntity ? record.legalBankDetails || '' : '';
  const bic = record.isLegalEntity ? record.legalBic || '' : '';
  const okpo = record.isLegalEntity ? record.legalOkpo || '' : '';

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}</head><body>
    <h1>СЧЁТ НА ОПЛАТУ</h1>
    <p class="subtitle">№ ${docNum} от ${date}</p>

    <div class="two-col" style="margin-bottom: 16px;">
      <div>
        <strong>Поставщик (Исполнитель):</strong><br>
        <span class="contract-text">
          Prime Auto Service<br>
          УНП: _______________<br>
          Адрес: _______________<br>
          р/с: _______________<br>
          Банк: _______________, БИК: _______________
        </span>
      </div>
      <div>
        <strong>Плательщик (Заказчик):</strong><br>
        <span class="contract-text">
          ${clientName}<br>
          ${unp ? `УНП: ${unp}<br>` : ''}
          ${address ? `Адрес: ${address}<br>` : ''}
          ${bankDetails ? `<span style="white-space:pre-wrap">${bankDetails}</span><br>` : ''}
          ${bic ? `БИК: ${bic}<br>` : ''}
          ${okpo ? `ОКПО: ${okpo}` : ''}
        </span>
      </div>
    </div>

    <p class="contract-text" style="margin-bottom:8px">
      Основание: услуги для автомобиля <strong>${record.car.brand} ${record.car.model} ${record.car.year}</strong>
      (договор № ${docNum} от ${date})
    </p>

    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">№</th>
          <th>Наименование услуги</th>
          <th style="text-align:center">Кол-во</th>
          <th style="text-align:right">Цена, р.</th>
          <th style="text-align:right">Сумма, р.</th>
        </tr>
      </thead>
      <tbody>${servicesRows}</tbody>
    </table>

    <div class="total" style="margin-top:16px">
      Итого к оплате: <strong>${formatPrice(total)}</strong>
    </div>

    <p class="contract-text" style="margin-top: 24px;">
      Оплата в течение 3 (трёх) банковских дней с момента выставления счёта.
    </p>

    <div class="signatures">
      <div>
        <div class="sig-line">Руководитель / ИП</div>
        <div class="note">Prime Auto Service</div>
      </div>
      <div>
        <div class="sig-line">Главный бухгалтер</div>
        <div class="note">&nbsp;</div>
      </div>
    </div>
  </body></html>`;

  openPrintWindow(html);
}
