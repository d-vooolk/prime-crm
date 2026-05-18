import { Record, CompanySettings } from '@/types';
import { formatDate, formatPrice } from './formatters';

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
    body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; padding: 15mm 20mm; }
    h1 { font-size: 16px; text-align: center; margin-bottom: 4px; font-weight: 700; text-transform: uppercase; }
    h2 { font-size: 13px; margin: 14px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; font-weight: 700; text-transform: uppercase; }
    .subtitle { text-align: center; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; }
    th, td { border: 1px solid #000; padding: 5px 8px; text-align: left; font-size: 11px; }
    th { font-weight: 700; background: #f0f0f0; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
    .block { margin-bottom: 10px; }
    .block-label { font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
    .block-value { border-bottom: 1px solid #000; padding-bottom: 2px; min-height: 18px; font-size: 12px; }
    .total { text-align: right; font-size: 13px; font-weight: 700; margin-top: 8px; border-top: 1px solid #000; padding-top: 4px; }
    .legal-text { font-size: 10px; line-height: 1.5; margin: 10px 0; color: #333; }
    .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 16px; }
    .sig-block { font-size: 11px; }
    .sig-line { border-top: 1px solid #000; margin-top: 24px; padding-top: 3px; }
    .sig-title { font-weight: 700; margin-bottom: 4px; }
    @media print { body { padding: 10mm 15mm; } }
  </style>
`;

// ─── Russian number to words ──────────────────────────────────────────────────

function numberToRussianWords(n: number): string {
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

// ─── Work order ───────────────────────────────────────────────────────────────

const DEFAULT_WORK_ORDER_TEMPLATE = `Дополнительные работы, необходимость в которых может возникнуть в процессе исполнения Заказа, их стоимость и сроки выполнения Исполнитель согласовывает с Заказчиком/Представителем устно и/или письменно с последующим отражением в документе, подтверждающий факт выполненных работ.
Исполнитель не несёт ответственность за несоответствие параметрам гос. стандартов при прохождении государственного технического осмотра.
Исполнитель имеет право на совершение фото и видео съёмки автомобиля, а так же на управление ТС для тех. целей.
Клиент обязуется забрать автомобиль в течение 24 часов с момента уведомления о завершении работ (по телефону, SMS, email или иным способом).
В случае, если клиент не забирает автомобиль в указанный срок, взимается плата за парковку в размере 15 белорусских рублей в день.
Мастерская не несёт материальной ответственности за повреждения, произошедшие на парковке (ДТП, угоны, стихийные бедствия и иные внешние воздействия).
Клиент принимает на себя все риски, связанные с дальнейшим хранением автомобиля на территории мастерской.

При наличии дефектов автомобиля, находящихся непосредственно в зоне проведения ремонтных работ, Заказчик обязан описать их ниже.
В случае обнаружения дефектов, влияющих на качественное выполнение работ, не указанных в документе, Исполнитель может взымать дополнительную плату за их исправление, с уведомлением или без уведомления Заказчика.
____________________________________________________________________`;

export function printWorkOrder(record: Record, settings?: CompanySettings, templateContent?: string): void {
  const total = record.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const docNum = record.documentNumber || record.id.slice(-8).toUpperCase();
  const createdDate = formatDate(record.createdAt);
  const legalText = (templateContent ?? DEFAULT_WORK_ORDER_TEMPLATE)
    .split('\n')
    .map(line => line.trim() ? `<p style="margin-bottom:4px">${line}</p>` : '<br>')
    .join('');

  const companyName = settings?.name || '—';
  const companyUnp = settings?.taxId ? `УНП: ${settings.taxId}` : '';
  const companyLegal = settings?.legalAddress ? `Юр. адрес: ${settings.legalAddress}` : '';
  const companyActual = settings?.actualAddress ? `Факт. адрес: ${settings.actualAddress}` : '';
  const companyPhone = settings?.phone ? `Телефон: ${settings.phone}` : '';
  const executorLines = [companyName, companyUnp, companyLegal, companyActual, companyPhone]
    .filter(Boolean).join('<br>');
  const totalPrepaid = record.items.reduce((s, i) => s + (i.prepaidAmount || 0), 0);
  const remaining = total - totalPrepaid;

  const carPlate = record.car.plateNumber || '—';
  const carMileage = record.car.mileage || '—';
  const clientDisplayName = record.isLegalEntity
    ? (record.legalCompanyName || record.client.name)
    : record.client.name;

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}</head><body>

    <h1>Заявка на проведение работ</h1>
    <p class="subtitle">№ ${docNum} от ${createdDate}</p>

    <div class="two-col">
      <div>
        <div class="block-label">Исполнитель:</div>
        <div style="font-size:11px;line-height:1.7">${executorLines || '&nbsp;'}</div>
      </div>
      <div>
        <div class="block-label">Заказчик:</div>
        <div class="block">
          <div class="block-label" style="font-weight:400">Собственник:</div>
          <div class="block-value">${record.client.name}</div>
        </div>
        <div class="block">
          <div class="block-label" style="font-weight:400">Телефон:</div>
          <div class="block-value">${record.client.phone}</div>
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
          <td>${carPlate}</td>
          <td>${record.car.year}</td>
          <td>${carMileage}</td>
        </tr>
      </tbody>
    </table>

    <h2>Перечень работ</h2>
    <p style="font-size:10px;margin-bottom:4px;font-style:italic">
      (неисправности ТС, подлежащие устранению или описание неисправностей)
    </p>
    <table>
      <thead>
        <tr>
          <th style="width:40px;text-align:center">№</th>
          <th>Наименование работ / услуг</th>
          <th style="text-align:center;width:70px">Кол-во</th>
          <th style="text-align:right;width:100px">Цена, р.</th>
          <th style="text-align:right;width:100px">Сумма, р.</th>
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
    <div class="total">Предварительная стоимость заказа: ${formatPrice(total).replace(' р.', '')} бел. руб.</div>
    ${totalPrepaid > 0 ? `
    <div style="margin-top:6px;font-size:12px;display:flex;justify-content:flex-end;gap:32px">
      <span>Предоплата: <strong>${formatPrice(totalPrepaid).replace(' р.', '')} бел. руб.</strong></span>
      <span>Остаток к оплате: <strong>${formatPrice(remaining).replace(' р.', '')} бел. руб.</strong></span>
    </div>` : ''}

    <div class="legal-text" style="margin-top:12px">${legalText}</div>

    <div class="sig-section">
      <div class="sig-block">
        <div class="sig-title">Заявку оформил:</div>
        <div style="font-size:11px;margin-bottom:16px">Мастер-приёмщик</div>
        <div class="sig-line">&nbsp;</div>
        <div style="margin-top:4px;font-size:11px">${record.receptionist || record.serviceman || ''}&nbsp;&nbsp;МП</div>
      </div>
      <div class="sig-block">
        <div class="sig-title">Заказчик/Представитель:</div>
        <div style="font-size:11px;margin-bottom:2px">
          Прошу принять ТС и произвести вышеперечисленные работы.<br>
          С условиями и обязанностями ознакомлен.
        </div>
        <div class="sig-line">&nbsp;</div>
        <div style="margin-top:4px;font-size:11px">${clientDisplayName}</div>
      </div>
    </div>

  </body></html>`;

  openPrintWindow(html);
}

// ─── Completion act (физлица) ─────────────────────────────────────────────────

const COMPLETION_ACT_WARRANTY = `Претензии не принимаются в случае не соблюдения заказчиком правил технической эксплуатации, дорожно-транспортного происшествия, при ремонте установленного агрегата, узла, детали, без предъявления ТС на предприятие автосервиса, а также в случае предъявления претензий после установленного срока. Гарантийный срок начинает исчисляться со дня приёмки потребителем ТС или агрегата. Предприятие не устанавливает гарантии на запчасти предоставленные заказчиком для ремонта, а так же на ремонт корпуса, креплений и стекла фары посредством пайки.
Претензии по качеству и объему выполненных услуг по обслуживанию могут быть предъявлены заказчиком в течении следующих гарантийных сроков:
- при условии разбора фары: на герметичность шва между стеклом и корпусом фары - в течение 365 дней при пробеге не более 50000 км;
Для действия гарантии фара должна соответствовать заводским параметрам герметичности.
При любом ДТП необходимо явиться к исполнителю для диагностики повреждений фар.
При несоответствии фары эксплуатационным характеристикам, не связанными с работой Исполнителя, необходимо в срок до 14 дней исправить все имеющиеся недостатки и предоставить доказательства исправления исполнителю.`;

const COMPLETION_ACT_ACCEPTANCE = `С объёмом работ согласен(на), перечень работ понятен, претензий к выполненным работам и состоянию ТС (как с внешней, так и с внутренней стороны) не имею, все работы приняты мною в полном объёме, качество мною проверено; само транспортное средство, ключи от него и документы на ТС от Подрядчика получила(а); с правилами оказания услуг по ремонту ТС согласно СТБ 1175-2011 ознакомлен(а), содержание мне понятно. Гарантийные обязательства на работы выполняются исполнителем только при предъявлении ТС, акта выполненных работ на проведённые работы и техпаспорта (доверенности). ТС — транспортное средство, автомобиль.`;

function buildCompletionActHtml(
  record: Record,
  settings: CompanySettings | undefined,
  date: string,
  defects: string | null,
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

  const defaultLegal = COMPLETION_ACT_WARRANTY + '\n\n' + COMPLETION_ACT_ACCEPTANCE;
  const legalHtml = (templateContent ?? defaultLegal)
    .split('\n')
    .map(line => line.trim() ? `<p style="margin-bottom:3px">${line}</p>` : '<br>')
    .join('');

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${printStyles}</head><body>

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

    ${defects ? field('Обнаруженные недостатки:', defects) : ''}
    ${equipmentBlock}

    <div style="margin-top:10px;font-size:12px;font-weight:700">Гарантийные обязательства:</div>
    <div class="legal-text" style="margin:4px 0 12px">${legalHtml}</div>

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
    record, settings, formatDate(record.deal.closedAt), record.deal.defects || null, templateContent,
  );
  openPrintWindow(html);
}

export function printBlankCompletionAct(record: Record, settings?: CompanySettings, templateContent?: string): void {
  const html = buildCompletionActHtml(
    record, settings, formatDate(record.scheduledAt), null, templateContent,
  );
  openPrintWindow(html);
}

// ─── Helpers for legal entity docs ───────────────────────────────────────────

function buildExecutorBlock(settings: CompanySettings | undefined): string {
  const lines: string[] = [];
  if (settings?.name) lines.push(`<strong>${settings.name}</strong>`);
  if (settings?.legalAddress) lines.push(`Адрес (юридич.): ${settings.legalAddress}`);
  if (settings?.actualAddress) lines.push(`Адрес (факт.): ${settings.actualAddress}`);
  if (settings?.postalAddress) lines.push(`Адрес (корр.): ${settings.postalAddress}`);
  if (settings?.bankDetails) {
    settings.bankDetails.split('\n').forEach(l => l.trim() && lines.push(l));
  }
  if (settings?.bic) lines.push(`БИК: ${settings.bic}`);
  if (settings?.taxId) lines.push(`УНП ${settings.taxId}`);
  if (settings?.phone) lines.push(`Телефон: ${settings.phone}`);
  return lines.join('<br>');
}

function buildCustomerBlock(record: Record): string {
  const lines: string[] = [];
  if (record.legalCompanyName) lines.push(`<strong>${record.legalCompanyName}</strong>`);
  if (record.legalAddress) lines.push(`Юридический адрес:<br>${record.legalAddress}`);
  if (record.legalActualAddress) lines.push(`Фактический (почтовый) адрес:<br>${record.legalActualAddress}`);
  if (record.legalUnp) lines.push(`УНП ${record.legalUnp}`);
  if (record.legalOkpo) lines.push(`ОКПО ${record.legalOkpo}`);
  if (record.legalBankDetails) {
    lines.push('Банковские реквизиты:');
    record.legalBankDetails.split('\n').forEach(l => l.trim() && lines.push(l));
  }
  return lines.join('<br>');
}

function servicesTableRows(record: Record): string {
  return record.items.map((item, i) => `
    <tr>
      <td style="text-align:center;width:36px">${i + 1}</td>
      <td>${item.service.name}</td>
      <td style="text-align:right;width:160px">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');
}

const legalDocStyles = `
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial', sans-serif; font-size: 11px; color: #000; padding: 15mm 20mm; line-height: 1.5; }
    .doc-title { font-size: 14px; font-weight: 700; text-align: center; margin-bottom: 4px; }
    .city-date { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 11px; }
    .section { margin: 12px 0; }
    .section-title { font-weight: 700; margin-bottom: 4px; }
    .clause { margin: 4px 0 4px 16px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #000; padding: 4px 8px; font-size: 11px; }
    th { font-weight: 700; background: #f0f0f0; }
    .total-row td { font-weight: 700; }
    .req-block { font-size: 11px; line-height: 1.7; }
    .sig-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 20px; gap: 40px; }
    .sig-col { flex: 1; font-size: 11px; }
    .sig-line { border-top: 1px solid #000; margin-top: 28px; padding-top: 4px; }
    .divider { border: none; border-top: 1px solid #ccc; margin: 16px 0; }
    @media print { body { padding: 10mm 15mm; } }
  </style>
`;

// ─── Договор ──────────────────────────────────────────────────────────────────

export function printServiceContract(record: Record, settings?: CompanySettings): void {
  const date = formatDate(record.scheduledAt);
  const docNum = record.documentNumber || record.id.slice(-8).toUpperCase();
  const companyName = settings?.name || '—';
  const customerName = record.legalCompanyName || record.client.name;
  // Представитель заказчика
  const repPositionGenitive = record.legalRepresentativePositionGenitive || '';
  const repNameGenitive = record.legalRepresentativeGenitive || '';
  const repPosition = record.legalRepresentativePosition || '';
  const repName = record.legalRepresentative || '';
  const repBasis = record.legalBasis || 'устава';
  // Подписант исполнителя (из записи, иначе директор из настроек)
  const execName = record.executorSignatoryName || settings?.directorName || '';
  const execNameGenitive = record.executorSignatoryNameGenitive || settings?.directorNameGenitive || settings?.directorName || '';
  const execPositionGenitive = record.executorSignatoryPositionGenitive || settings?.directorPositionGenitive || 'директора';
  const execBasis = record.executorSignatoryBasis || settings?.directorBasis || 'устава';
  const endDate = record.legalEndDate ? formatDate(record.legalEndDate) : '';
  const total = record.deal
    ? record.deal.finalPrice
    : record.items.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalWords = numberToRussianWords(total);
  const servicesList = record.items.map(i =>
    `${i.service.name}${i.quantity > 1 ? ` (${i.quantity} шт.)` : ''}`
  ).join(', ');
  const vinPart = record.legalVin ? `, VIN: ${record.legalVin}` : '';
  const platePart = record.car.plateNumber ? `, г/н ${record.car.plateNumber}` : '';
  const car = `${record.car.brand} ${record.car.model} ${record.car.year}${vinPart}${platePart}`;

  // Вступительный абзац — род. падеж
  const repPartGenitive = [repPositionGenitive, repNameGenitive].filter(Boolean).join(' ');
  const customerIntro = repPartGenitive
    ? `${customerName}, в лице ${repPartGenitive} действующего на основании ${repBasis}`
    : `${customerName}`;
  const executorIntro = execNameGenitive
    ? `${companyName}, в лице ${execPositionGenitive} ${execNameGenitive} на основании ${execBasis}`
    : `${companyName}`;

  // Подпись заказчика снизу — именит. падеж
  const customerSig = [repPosition, repName].filter(Boolean).join(' ');

  const executorBlock = buildExecutorBlock(settings);
  const customerBlock = buildCustomerBlock(record);

  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">${legalDocStyles}</head><body>

    <div class="doc-title">ДОГОВОР № ${docNum} от ${date}</div>

    <div class="city-date">
      <span>г. Минск</span>
      <span>${date}г.</span>
    </div>

    <p style="margin-bottom:14px;text-align:justify">
      ${customerIntro}, именуемый в дальнейшем "Заказчик", и
      ${executorIntro} именуемое в дальнейшем "Исполнитель",
      заключили настоящий договор о нижеследующем.
    </p>

    <div class="section">
      <div class="section-title">1. Предмет договора</div>
      <div class="clause">1.1. По договору возмездного оказания услуг Исполнитель обязуется по заданию Заказчика оказать услуги, указанные в п. 1.2 настоящего договора, а Заказчик обязуется принять и оплатить эти услуги.</div>
      <div class="clause">1.2. Исполнитель обязуется оказать следующие услуги: ${servicesList} на автомобиле ${car}, именуемые в дальнейшем "Услуги"</div>
      <div class="clause">1.3. Срок, в течение которого Исполнитель обязан оказать услуги по настоящему договору, устанавливается: с ${date}${endDate ? ` до ${endDate}` : ''}. В этот период Исполнитель самостоятельно определяет временные интервалы для оказания конкретных услуг, указанных в п. 1.2. настоящего договора, однако при этом о времени оказания услуг уведомляет Заказчика для того, чтобы последний мог принять их надлежащим образом. Исполнитель имеет право завершить оказание услуг досрочно.</div>
      <div class="clause">1.4. Услуги считаются оказанными после подписания акта приема-сдачи Услуг Заказчиком или его уполномоченным представителем.</div>
    </div>

    <div class="section">
      <div class="section-title">2. Права и обязанности сторон</div>
      <div class="clause">2.1. Исполнитель обязан:</div>
      <div class="clause">2.1.1. Оказать Услуги с надлежащим качеством.</div>
      <div class="clause">2.1.2. Оказать Услуги в полном объеме в срок, указанный в п. 1.3. настоящего договора.</div>
      <div class="clause">2.1.3. Безвозмездно исправить по требованию Заказчика все выявленные недостатки, если в процессе оказания Услуг Исполнитель допустил отступление от условий договора, ухудшившее их качество, в течение 5 дней.</div>
      <div class="clause">2.2. Исполнитель вправе привлечь к оказанию услуг по настоящему договору третьих лиц с письменного согласия Заказчика.</div>
      <div class="clause">2.3. Заказчик обязан:</div>
      <div class="clause">2.3.1. Обеспечить условия для оказания Исполнителем услуг.</div>
      <div class="clause">2.3.2. Принять по акту приемо-сдачи услуг и оплатить услуги по цене, указанной в п. 3 настоящего договора, в течение 5 дней с момента подписания акта приема-сдачи Услуг.</div>
      <div class="clause">2.4. Заказчик имеет право:</div>
      <div class="clause">2.4.1. Во всякое время проверять ход и качество работы, выполняемой Исполнителем, не вмешиваясь в его деятельность.</div>
      <div class="clause">2.4.2. Отказаться от исполнения договора в любое время до подписания акта, уплатив Исполнителю часть установленной цены пропорционально части оказанных Услуг, выполненной до получения извещения об отказе Заказчика от исполнения договора.</div>
    </div>

    <div class="section">
      <div class="section-title">3. Цена договора</div>
      <div class="clause">3.1 Цена настоящего договора составляет: ${formatPrice(total).replace(' р.', '')} бел. руб. (${totalWords} белорусских рублей) (Без НДС)</div>
    </div>

    <div class="section">
      <div class="section-title">4. Прочие условия</div>
      <div class="clause">4.1. Споры и разногласия, которые могут возникнуть при исполнении настоящего договора, будут по возможности разрешаться путем переговоров между сторонами.</div>
      <div class="clause">4.2. В случае невозможности разрешения споров путем переговоров стороны после реализации предусмотренной законодательством процедуры досудебного урегулирования разногласий передают их на рассмотрение в суд по месту нахождения Заказчика.</div>
      <div class="clause">4.2. Любые изменения и дополнения к настоящему договору действительны лишь при условии, что они совершены в письменной форме и подписаны уполномоченными на то представителями сторон. Приложения к настоящему договору составляют его неотъемлемую часть.</div>
      <div class="clause">4.3. Настоящий договор составлен в двух экземплярах. Оба экземпляра идентичны и имеют одинаковую силу. У каждой из сторон находится один экземпляр настоящего договора.</div>
    </div>

    <div class="section" style="page-break-before:always;padding-top:15mm">
      <div class="section-title">5. Реквизиты и подписи сторон</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:8px">
        <div class="req-block">
          <strong>Заказчик:</strong><br>
          ${customerBlock}
        </div>
        <div class="req-block">
          <strong>Исполнитель:</strong><br>
          ${executorBlock}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-top:32px">
        <div style="flex:1;font-size:11px">
          Заказчик ______________________________<br>
          <br>
          ${customerSig ? `${customerSig}&nbsp;&nbsp;&nbsp;&nbsp;МП` : 'МП'}
        </div>
        <div style="flex:1;font-size:11px">
          Исполнитель ______________________________<br>
          <br>
          ${execName ? `${execName}&nbsp;&nbsp;&nbsp;&nbsp;МП` : 'МП'}
        </div>
      </div>
    </div>

  </body></html>`;

  openPrintWindow(html);
}

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
