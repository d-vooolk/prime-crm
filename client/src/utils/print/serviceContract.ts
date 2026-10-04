import { Record, CompanySettings } from '@/types';
import { formatDate, formatPrice } from '../formatters';
import { openPrintWindow } from './shared';
import { numberToRussianWords } from './numberToWords';
import { buildCustomerBlock, buildExecutorBlock, legalDocStyles } from './legalShared';

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
          <strong>Исполнитель:</strong><br>
          ${executorBlock}
        </div>
        <div class="req-block">
          <strong>Заказчик:</strong><br>
          ${customerBlock}
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:40px;margin-top:32px">
        <div style="flex:1;font-size:11px">
          Исполнитель ______________________________<br>
          <br>
          ${execName ? `${execName}&nbsp;&nbsp;&nbsp;&nbsp;МП` : 'МП'}
        </div>
        <div style="flex:1;font-size:11px">
          Заказчик ______________________________<br>
          <br>
          ${customerSig ? `${customerSig}&nbsp;&nbsp;&nbsp;&nbsp;МП` : 'МП'}
        </div>
      </div>
    </div>

  </body></html>`;

  openPrintWindow(html);
}

