import { Record, CompanySettings } from '@/types';
import { formatPrice } from '../formatters';

// ─── Helpers for legal entity docs ───────────────────────────────────────────

export function buildExecutorBlock(settings: CompanySettings | undefined): string {
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

export function buildCustomerBlock(record: Record): string {
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

export function servicesTableRows(record: Record): string {
  return record.items.map((item, i) => `
    <tr>
      <td style="text-align:center;width:36px">${i + 1}</td>
      <td>${item.service.name}</td>
      <td style="text-align:right;width:160px">${formatPrice(item.price * item.quantity)}</td>
    </tr>
  `).join('');
}

export const legalDocStyles = `
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
