import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CompanySettings, DocumentTemplate, Record } from '@/types';
import {
  printWorkOrder, printCompletionAct, printServiceContract, printInvoice, printBlankCompletionAct, printLegalAct,
} from '@/utils/print';
import { useNotify } from '@/hooks/useNotify';
import { loadPrintData } from './printData';
import { actTemplatesOf, defaultActTemplate, pickActTemplate, pickWorkOrderTemplate, recordCategoryIds } from './documentTemplates';

/** Выбор шаблона акта, когда в записи услуги разных категорий */
export interface ActTemplateChoice {
  templates: DocumentTemplate[];
  settings: CompanySettings | undefined;
  selectedId: string | null;
}

/** Печать документов по записи: заявка, акт, договор, счёт */
export function useRecordPrint(record: Record | null) {
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [printing, setPrinting] = useState(false);
  const [templateChoice, setTemplateChoice] = useState<ActTemplateChoice | null>(null);

  // Общая обёртка: индикатор, загрузка реквизитов/шаблонов и сообщение, если печать не удалась
  const run = async (action: (rec: Record, data: Awaited<ReturnType<typeof loadPrintData>>) => void) => {
    if (!record) return;
    setPrinting(true);
    try {
      action(record, await loadPrintData(queryClient));
    } catch (e) {
      notify.error(e, 'Не удалось подготовить документ');
    } finally {
      setPrinting(false);
    }
  };

  const printActWith = (rec: Record, settings: CompanySettings | undefined, content: string | undefined) => {
    if (rec.deal) printCompletionAct(rec, settings, content);
    else printBlankCompletionAct(rec, settings, content);
  };

  const workOrder = () => run((rec, { settings, templates }) => {
    printWorkOrder(rec, settings, pickWorkOrderTemplate(rec, templates)?.content);
  });

  const act = () => run((rec, { settings, templates }) => {
    if (rec.isLegalEntity) {
      printLegalAct(rec, settings);
      return;
    }
    const actTemplates = actTemplatesOf(templates);
    // Услуги разных категорий и несколько шаблонов — пусть выберут вручную
    if (recordCategoryIds(rec).length > 1 && actTemplates.length > 1) {
      setTemplateChoice({ templates: actTemplates, settings, selectedId: defaultActTemplate(actTemplates)?.id ?? null });
      return;
    }
    printActWith(rec, settings, pickActTemplate(rec, actTemplates)?.content);
  });

  const contract = () => run((rec, { settings }) => printServiceContract(rec, settings));
  const invoice = () => run((rec, { settings }) => printInvoice(rec, settings));

  const printChosenAct = () => {
    if (!templateChoice || !record) return;
    const template = templateChoice.templates.find(t => t.id === templateChoice.selectedId);
    try {
      printActWith(record, templateChoice.settings, template?.content);
    } catch (e) {
      notify.error(e, 'Не удалось подготовить документ');
    }
    setTemplateChoice(null);
  };

  return {
    printing, workOrder, act, contract, invoice,
    templateChoice, setTemplateChoice, printChosenAct,
  };
}
