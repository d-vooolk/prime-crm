import type { QueryClient } from '@tanstack/react-query';
import { referenceQueries } from '@/hooks/useReferenceData';
import type { CompanySettings, DocumentTemplate } from '@/types';

/**
 * Настройки компании и шаблоны для печати — из общего кеша справочников (те же опции,
 * что у useCompanySettings/useDocTemplates), запрос только если кеш устарел.
 * Грузим по нажатию «Печать», а не при открытии карточки: печатают не все и не всегда.
 */
export async function loadPrintData(qc: QueryClient): Promise<{ settings?: CompanySettings; templates: DocumentTemplate[] }> {
  const [settings, templates] = await Promise.all([
    // Намеренно без пробрасывания: при сбое печатаем без реквизитов/шаблона, как и раньше,
    // а саму ошибку уже показал QueryErrorReporter
    qc.fetchQuery(referenceQueries.companySettings).catch(() => undefined),
    qc.fetchQuery(referenceQueries.docTemplates).catch(() => [] as DocumentTemplate[]),
  ]);
  return { settings, templates };
}
