import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal, Form, Input, Select, Button, Divider, Empty, Grid } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useNotify } from '@/hooks/useNotify';
import { useAllServicemen } from '@/hooks/useReferenceData';
import { Record, CompanySettings, CurrencyPart } from '@/types';
import { recordsApi } from '@/api/records.api';
import { currencyPartsByn, currencyPartsValid } from '@/components/CurrencyConverter';
import { printCompletionAct } from '@/utils/print';
import { DealCelebration } from '../DealCelebration';
import { loadPrintData } from '../RecordDetailModal/printData';
import { actTemplatesOf, pickActTemplate } from '../RecordDetailModal/documentTemplates';
import { ItemRow, buildItemRows, itemsMissingServiceman, paymentTotals, splitPayment } from './closeDeal.utils';
import { ItemsTable } from './ItemsTable';
import { PaymentSection } from './PaymentSection';
import { ServicemanSplitModal } from './ServicemanSplitModal';
import { PaymentSplitModal } from './PaymentSplitModal';
import styles from './CloseRecordModal.module.scss';

const { useBreakpoint } = Grid;

interface Props {
  record: Record;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const WARRANTY_OPTIONS = [
  { value: 'Без гарантии', label: 'Без гарантии' },
  { value: '1 месяц', label: '1 месяц' },
  { value: '6 месяцев', label: '6 месяцев' },
  { value: '1 год', label: '1 год' },
];

// Подставляется в новую сделку; у уже закрытых берётся сохранённое значение
const DEFAULT_WARRANTY = '1 месяц';

export const CloseRecordModal: React.FC<Props> = ({ record, open, onClose, onSuccess }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [items, setItems] = useState<ItemRow[]>([]);

  // Исполнители — из общего кеша справочника, а не запросом при каждом открытии
  const { data: allServicemen } = useAllServicemen();
  const employees = useMemo(
    () => (allServicemen ?? []).filter(s => s.isPerformer && !s.isDismissed),
    [allServicemen],
  );

  const pendingPrintRef = useRef<{
    record: Record;
    settings: CompanySettings | undefined;
    templateContent: string | undefined;
  } | null>(null);

  // Разделение услуги между сотрудниками
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitItemId, setSplitItemId] = useState<string | null>(null);

  // Раздельная оплата нал/безнал
  const [paymentSplitOpen, setPaymentSplitOpen] = useState(false);
  const [paymentSplitCard, setPaymentSplitCard] = useState<number | null>(null);
  // Часть остатка, оплаченная валютой, и открыт ли блок валюты
  const [currencyParts, setCurrencyParts] = useState<CurrencyPart[]>([]);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const notify = useNotify();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    setItems(buildItemRows(record));

    if (record.deal) {
      form.setFieldsValue({
        defects: record.deal.defects || '',
        recommendations: record.deal.recommendations || '',
        warranty: record.deal.warranty || '',
        isPaidByBankTransfer: record.deal.isPaidByBankTransfer || false,
      });
      setPaymentSplitCard(record.deal.splitCardAmount ?? null);
      setCurrencyParts(record.deal.currencyPayments ?? []);
      setCurrencyOpen(!!record.deal.currencyPayments?.length);
    } else {
      form.resetFields();
      setPaymentSplitCard(null);
      setCurrencyParts([]);
      setCurrencyOpen(false);
    }
  }, [open, record, form]);

  const updateItemServiceman = (itemId: string, servicemanName: string) => {
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, servicemanName, split: null } : i));
  };

  const saveSplit = (entries: ItemRow['split']) => {
    setItems(prev => prev.map(i => i.itemId === splitItemId ? { ...i, split: entries, servicemanName: '' } : i));
    setSplitOpen(false);
  };

  const cancelSplit = (itemId: string) => {
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, split: null, servicemanName: record.serviceman ?? '' } : i));
  };

  const hasEmployees = employees.length > 0;
  const employeeOptions = employees.map(e => ({ value: e.name, label: e.name }));
  const missingServiceman = hasEmployees ? itemsMissingServiceman(items) : [];

  const currencyByn = currencyPartsByn(currencyParts);
  const totals = paymentTotals(items, currencyByn);

  const handleClose = async () => {
    const values = await form.validateFields().catch(() => null);
    // Ошибки полей antd уже подсветил в форме
    if (!values) return;
    if (!currencyPartsValid(currencyParts)) {
      notify.warning('Укажите сумму и курс для каждой валюты');
      return;
    }

    if (missingServiceman.length > 0) {
      notify.warning(
        'Укажите сотрудника',
        `Не указан сотрудник для: ${missingServiceman.map(i => i.serviceName).join(', ')}`,
      );
      return;
    }

    setLoading(true);
    try {
      await recordsApi.update(record.id, {
        items: items.map(i => ({
          serviceId: i.serviceId,
          price: i.price,
          quantity: i.quantity,
          servicemanName: i.split?.length ? undefined : i.servicemanName,
          equipmentId: i.equipmentId,
          servicemanSplit: i.split?.length ? i.split : null,
          prepaidAmount: i.prepaidAmount,
          prepaidByCard: i.prepaidByCard,
        })),
      });

      // Разбивка нал/карта — от рублёвого остатка после валюты
      await recordsApi.close(record.id, {
        finalPrice: totals.total,
        defects: values.defects || undefined,
        recommendations: values.recommendations || undefined,
        warranty: values.warranty || undefined,
        isPaidByBankTransfer: values.isPaidByBankTransfer || false,
        ...splitPayment(totals.rubleRemaining, paymentSplitCard),
        currencyPayments: currencyParts,
      });

      const [freshRecord, { settings, templates }] = await Promise.all([
        recordsApi.getById(record.id),
        loadPrintData(queryClient),
      ]);

      const actTemplate = pickActTemplate(freshRecord, actTemplatesOf(templates));
      pendingPrintRef.current = { record: freshRecord, settings, templateContent: actTemplate?.content };

      onClose();
      setCelebrating(true);
      setTimeout(() => onSuccess(), 2100);
      setTimeout(() => {
        const pd = pendingPrintRef.current;
        pendingPrintRef.current = null;
        if (!pd?.record.deal) return;
        try {
          printCompletionAct(pd.record, pd.settings, pd.templateContent);
        } catch (e) {
          notify.error(e, 'Не удалось распечатать акт');
        }
      }, 2400);
    } catch (e: unknown) {
      notify.error(e, 'Не удалось закрыть сделку');
    } finally {
      setLoading(false);
    }
  };

  const changeCurrencyParts = useCallback((parts: CurrencyPart[]) => {
    setCurrencyParts(parts);
    // Разбивка нал/карта считалась от прежнего остатка
    setPaymentSplitCard(null);
    if (parts.length === 0) setCurrencyOpen(false);
  }, []);

  const splitItem = items.find(i => i.itemId === splitItemId);

  return (
    <>
      {celebrating && <DealCelebration onDone={() => setCelebrating(false)} />}

      <ServicemanSplitModal
        open={splitOpen}
        item={splitItem}
        defaultServiceman={record.serviceman ?? ''}
        employeeOptions={employeeOptions}
        onCancel={() => setSplitOpen(false)}
        onSave={saveSplit}
      />

      <PaymentSplitModal
        open={paymentSplitOpen}
        rubleRemaining={totals.rubleRemaining}
        initialCard={paymentSplitCard}
        onCancel={() => setPaymentSplitOpen(false)}
        onApply={card => {
          setPaymentSplitCard(card);
          setPaymentSplitOpen(false);
        }}
      />

      <Modal
        open={open}
        onCancel={onClose}
        title="Закрыть сделку"
        width={hasEmployees ? 820 : 620}
        footer={null}
        destroyOnHidden
        transitionName={isMobile ? '' : undefined}
        maskTransitionName={isMobile ? '' : undefined}
        className={styles.modal}
        classNames={{
          wrapper: styles.modalWrap,
          content: styles.modalContent,
          body: styles.modalBody,
        }}
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" className={styles.divider}>Перечень работ</Divider>

          {items.length === 0 ? (
            <Empty description="Нет услуг" className={styles.empty} />
          ) : (
            <ItemsTable
              items={items}
              totals={totals}
              hasEmployees={hasEmployees}
              employeeOptions={employeeOptions}
              onChangeServiceman={updateItemServiceman}
              onOpenSplit={row => { setSplitItemId(row.itemId); setSplitOpen(true); }}
              onCancelSplit={cancelSplit}
            />
          )}

          <Divider orientation="left" className={styles.divider}>Дефекты и рекомендации</Divider>

          <Form.Item label="Обнаруженные недостатки в процессе работы" name="defects">
            <Input.TextArea rows={3} placeholder="Описание дефектов, обнаруженных в ходе выполнения работ" />
          </Form.Item>

          <Form.Item label="Рекомендации" name="recommendations">
            <Input.TextArea rows={3} placeholder="Что рекомендовано клиенту: замена, повторный осмотр и т.п." />
          </Form.Item>

          <Divider orientation="left" className={styles.divider}>Гарантия</Divider>

          <Form.Item label="Гарантия на работу" name="warranty" initialValue={DEFAULT_WARRANTY}>
            <Select
              placeholder="Выберите срок гарантии"
              allowClear
              options={WARRANTY_OPTIONS}
            />
          </Form.Item>

          <PaymentSection
            totals={totals}
            currencyByn={currencyByn}
            currencyParts={currencyParts}
            currencyOpen={currencyOpen}
            onOpenCurrency={() => setCurrencyOpen(true)}
            onChangeCurrency={changeCurrencyParts}
            paymentSplitCard={paymentSplitCard}
            onOpenPaymentSplit={() => setPaymentSplitOpen(true)}
            onCancelPaymentSplit={() => setPaymentSplitCard(null)}
          />

          <div className={styles.footer}>
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" loading={loading} onClick={handleClose}>
              Завершить сделку
            </Button>
          </div>
        </Form>
      </Modal>
    </>
  );
};
