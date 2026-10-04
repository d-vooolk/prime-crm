import { Record, CompanySettings } from '@/types';
import { formatDate, formatPrice } from '../formatters';
import { openPrintWindow, printStyles } from './shared';

const DEFAULT_WORK_ORDER_TEMPLATE = `Дополнительные работы, необходимость в которых может возникнуть в процессе исполнения Заказа, их стоимость и сроки выполнения Исполнитель согласовывает с Заказчиком/Представителем устно и/или письменно с последующим отражением в документе, подтверждающий факт выполненных работ.
Исполнитель не несёт ответственность за несоответствие параметрам гос. стандартов при прохождении государственного технического осмотра.
Исполнитель имеет право на совершение фото и видео съёмки автомобиля, а так же на управление ТС для тех. целей.
Клиент обязуется забрать автомобиль в течение 24 часов с момента уведомления о завершении работ (по телефону, SMS, email или иным способом).
В случае, если клиент не забирает автомобиль в указанный срок, взимается плата за парковку в размере 15 белорусских рублей в день.
Мастерская не несёт материальной ответственности за повреждения, произошедшие на парковке (ДТП, угоны, стихийные бедствия и иные внешние воздействия).
Клиент принимает на себя все риски, связанные с дальнейшим хранением автомобиля на территории мастерской.

При наличии дефектов автомобиля, находящихся непосредственно в зоне проведения ремонтных работ, Заказчик обязан описать их ниже.
В случае обнаружения дефектов, влияющих на качественное выполнение работ, не указанных в документе, Исполнитель может взымать дополнительную плату за их исправление, с уведомлением или без уведомления Заказчика.

Заказчик даёт право Исполнителю на обработку персональных данных, отправку смс-рассылки с информацией касающейся текущего или последующих ремонтов.
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
