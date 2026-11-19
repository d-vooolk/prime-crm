import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal, Form, Input, Select, Button, Divider, Empty, Grid } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import { useNotify } from '@/hooks/useNotify';
import { useAuthStore } from '@/store/authStore';
import { hasStaffAndCash } from '@/utils/roles';
import { useAllServicemen, useClientSources } from '@/hooks/useReferenceData';
import { Record, CompanySettings, CurrencyPart } from '@/types';
import { recordsApi } from '@/api/records.api';
import { roundMoney } from '@/utils/formatters';
import { currencyPartsByn, currencyPartsValid } from '@/components/CurrencyConverter';
import { printCompletionAct } from '@/utils/print';
import { DEFAULT_WARRANTY, WARRANTY_OPTIONS } from '@/utils/print/warranty';
import { DealCelebration } from '../DealCelebration';
import { loadPrintData } from '../RecordDetailModal/printData';
import { actTemplatesOf, pickActTemplate } from '../RecordDetailModal/documentTemplates';
import { ActLine, ItemRow, buildItemRows, correctedActRecord, itemsMissingServiceman, paymentTotals, splitPayment } from './closeDeal.utils';
import { ItemsTable } from './ItemsTable';
import { PaymentSection } from './PaymentSection';
import { ServicemanSplitModal } from './ServicemanSplitModal';
import { PaymentSplitModal } from './PaymentSplitModal';
import { CorrectedActModal } from './CorrectedActModal';
import { toServicemanOption } from '@/components/ServicemanBadge';
import styles from './CloseRecordModal.module.scss';

const { useBreakpoint } = Grid;

interface Props {
  record: Record;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CloseRecordModal: React.FC<Props> = ({ record, open, onClose, onSuccess }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  // Сумма и автомобиль для анимации закрытия; null — анимации нет
  const [celebration, setCelebration] = useState<{ amount: number; caption: string } | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  // В облегчённом режиме (после тревожной кнопки) источников клиента нет, оплата — только по РС
  const withCash = hasStaffAndCash(useAuthStore(s => s.user));

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
  // Исправленный акт при раздельной оплате — только печать, без сохранения
  const [correctedActOpen, setCorrectedActOpen] = useState(false);
  const [correctedActLoading, setCorrectedActLoading] = useState(false);

  // Источник клиента — обязателен для закрытия; повторяет поле из записи, чтобы не возвращаться в неё
  const { data: clientSources } = useClientSources();
  const sourceOptions = useMemo(() => {
    const options = (clientSources ?? []).map(s => ({ value: s.id, label: s.name }));
    // Сохранённый в записи, но скрытый из списка в настройках — тоже показываем
    const saved = record.clientSource;
    if (saved && !options.some(o => o.value === saved.id)) options.push({ value: saved.id, label: saved.name });
    return options;
  }, [clientSources, record.clientSource]);

  const notify = useNotify();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    setItems(buildItemRows(record));

    if (record.deal) {
      form.setFieldsValue({
        defects: record.defects || '',
        recommendations: record.deal.recommendations || '',
        warranty: record.deal.warranty || '',
        isPaidByBankTransfer: record.deal.isPaidByBankTransfer || false,
        clientSourceId: record.clientSourceId ?? undefined,
      });
      setPaymentSplitCard(record.deal.splitCardAmount ?? null);
      setCurrencyParts(record.deal.currencyPayments ?? []);
      setCurrencyOpen(!!record.deal.currencyPayments?.length);
    } else {
      form.resetFields();
      // Недостатки могли записать в карточке до закрытия. Юрлицо платит по расчётному счёту,
      // гарантия у него — указанная при оформлении (она уже в договоре)
      form.setFieldsValue({
        defects: record.defects || '',
        clientSourceId: record.clientSourceId ?? undefined,
        isPaidByBankTransfer: !!record.isLegalEntity,
        ...(record.isLegalEntity && record.legalWarranty && { warranty: record.legalWarranty }),
      });
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
  const employeeOptions = employees.map(toServicemanOption);
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
        // Старые закрытые сделки могли быть без источника — пустое поле их не трогает
        ...(values.clientSourceId ? { clientSourceId: values.clientSourceId } : {}),
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
        // Пустая строка очищает недостатки в записи
        defects: values.defects ?? '',
        recommendations: values.recommendations || undefined,
        warranty: values.warranty || undefined,
        isPaidByBankTransfer: !withCash || values.isPaidByBankTransfer || false,
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
      setCelebration({ amount: totals.total, caption: `${record.car.brand} ${record.car.model}` });
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

  const printCorrectedAct = async (lines: ActLine[]) => {
    setCorrectedActLoading(true);
    try {
      const values = form.getFieldsValue();
      const actRecord = correctedActRecord(record, lines, values);
      const { settings, templates } = await loadPrintData(queryClient);
      printCompletionAct(actRecord, settings, pickActTemplate(actRecord, actTemplatesOf(templates))?.content);
      setCorrectedActOpen(false);
    } catch (e) {
      notify.error(e, 'Не удалось распечатать акт');
    } finally {
      setCorrectedActLoading(false);
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
      {celebration && (
        <DealCelebration
          amount={celebration.amount}
          caption={celebration.caption}
          onDone={() => setCelebration(null)}
        />
      )}

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

      <CorrectedActModal
        open={correctedActOpen}
        record={record}
        cashAmount={roundMoney(totals.rubleRemaining - (paymentSplitCard ?? 0))}
        cardAmount={paymentSplitCard ?? 0}
        loading={correctedActLoading}
        onCancel={() => setCorrectedActOpen(false)}
        onPrint={printCorrectedAct}
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

          {withCash && (
            <>
              <Divider orientation="left" className={styles.divider}>Источник клиента</Divider>

              {/* Обязателен для новой сделки (проверяет и сервер); у старых закрытых его может не быть */}
              <Form.Item
                label="Откуда клиент узнал о нас"
                name="clientSourceId"
                rules={record.deal ? [] : [{ required: true, message: 'Укажите источник клиента' }]}
              >
                <Select placeholder="Выберите источник" options={sourceOptions} showSearch optionFilterProp="label" />
              </Form.Item>
            </>
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

          {withCash && (
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
              onOpenCorrectedAct={() => setCorrectedActOpen(true)}
            />
          )}

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
