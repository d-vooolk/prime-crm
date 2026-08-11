import React, { useState, useEffect } from 'react';
import {
  Modal, Button, Descriptions, Tag, Divider, Table, message,
  Popconfirm, InputNumber, Tooltip, Grid, Radio, Form,
} from 'antd';
const { useBreakpoint } = Grid;
import {
  PrinterOutlined, CheckCircleOutlined, CloseCircleOutlined,
  DeleteOutlined, ReloadOutlined, CalendarOutlined,
  CarOutlined, StarOutlined, HistoryOutlined,
} from '@ant-design/icons';
import { Record as CrmRecord, DocumentTemplate, CompanySettings } from '@/types';
import { formatPrice, formatDate, formatTime } from '@/utils/formatters';
import { printWorkOrder, printCompletionAct, printServiceContract, printInvoice, printBlankCompletionAct, printLegalAct } from '@/utils/print';
import { CloseRecordModal } from '../CloseRecordModal';
import { RecordModal } from '../RecordModal';
import { ClientHistoryDrawer } from '../ClientHistoryDrawer';
import { recordsApi } from '@/api/records.api';
import { servicesApi } from '@/api/services.api';
import { useAuthStore } from '@/store/authStore';
import { useNotify } from '@/hooks/useNotify';
import styles from './RecordDetailModal.module.scss';

interface Props {
  record: CrmRecord | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'blue', label: 'Активна' },
  CLOSED: { color: 'green', label: 'Завершена' },
  CANCELLED: { color: 'red', label: 'Отменена' },
};

export const RecordDetailModal: React.FC<Props> = ({ record, open, onClose, onRefresh }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuthStore();
  const notify = useNotify();
  const isEmployee = user?.role === 'Сотрудник';
  const canDelete = user?.isMaster || user?.role === 'Создатель';
  const [localRecord, setLocalRecord] = useState(record);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [templateModal, setTemplateModal] = useState<{
    templates: DocumentTemplate[];
    settings: CompanySettings | undefined;
    selectedId: string | null;
  } | null>(null);
  const [smsSending, setSmsSending] = useState<'CAR_READY' | 'REVIEW_REQUEST' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [retainedCash, setRetainedCash] = useState(0);
  const [retainedCard, setRetainedCard] = useState(0);

  const fetchPrintData = async () => {
    const [settings, templates] = await Promise.all([
      servicesApi.getSettings().catch(() => undefined),
      servicesApi.getDocTemplates().catch(() => []),
    ]);
    return { settings, templates };
  };

  const handlePrintWorkOrder = async () => {
    if (!record) return;
    const rec = localRecord ?? record;
    setPrinting(true);
    try {
      const { settings, templates } = await fetchPrintData();
      const categoryId = rec.items[0]?.service?.categoryId;
      const template = templates.find(t => t.categoryId === categoryId && t.type === 'work_order')
        || templates.find(t => !t.categoryId && t.type === 'work_order' && t.isDefault)
        || templates.find(t => t.type === 'work_order');
      printWorkOrder(rec, settings, template?.content);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintAct = async () => {
    if (!record) return;
    const rec = localRecord ?? record;
    setPrinting(true);
    try {
      const { settings, templates } = await fetchPrintData();
      if (rec.isLegalEntity) {
        printLegalAct(rec, settings);
        return;
      }

      const actTemplates = templates.filter(t => t.type === 'completion_act');
      const categoryIds = [...new Set(
        rec.items.map(i => i.service?.categoryId).filter((id): id is string => !!id)
      )];

      if (categoryIds.length > 1 && actTemplates.length > 1) {
        const defaultTemplate = actTemplates.find(t => !t.categoryId && t.isDefault)
          ?? actTemplates.find(t => t.isDefault)
          ?? actTemplates[0];
        setTemplateModal({ templates: actTemplates, settings, selectedId: defaultTemplate?.id ?? null });
        return;
      }

      const categoryId = categoryIds[0] ?? null;
      const actTemplate = (categoryId ? actTemplates.find(t => t.categoryId === categoryId) : null)
        ?? actTemplates.find(t => !t.categoryId && t.isDefault)
        ?? actTemplates.find(t => t.isDefault)
        ?? actTemplates[0];

      if (rec.deal) printCompletionAct(rec, settings, actTemplate?.content);
      else printBlankCompletionAct(rec, settings, actTemplate?.content);
    } finally {
      setPrinting(false);
    }
  };

  const handleTemplateModalPrint = () => {
    if (!templateModal || !record) return;
    const rec = localRecord ?? record;
    const template = templateModal.templates.find(t => t.id === templateModal.selectedId);
    if (rec.deal) printCompletionAct(rec, templateModal.settings, template?.content);
    else printBlankCompletionAct(rec, templateModal.settings, template?.content);
    setTemplateModal(null);
  };

  const handlePrintContract = async () => {
    if (!record) return;
    const rec = localRecord ?? record;
    setPrinting(true);
    try {
      const { settings } = await fetchPrintData();
      printServiceContract(rec, settings);
    } finally {
      setPrinting(false);
    }
  };

  const handlePrintInvoice = async () => {
    if (!record) return;
    const rec = localRecord ?? record;
    setPrinting(true);
    try {
      const { settings } = await fetchPrintData();
      printInvoice(rec, settings);
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (open && record) {
      setLocalRecord(record);
    }
  }, [open, record?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavedClosed = async () => {
    if (!record) return;
    try {
      const fresh = await recordsApi.getById(record.id);
      setLocalRecord(fresh);
      setCloseModalOpen(true);
    } catch {
      message.error('Не удалось обновить данные записи');
    }
  };

  if (!record) return null;

  const r = localRecord ?? record;
  const status = STATUS_MAP[r.status] || STATUS_MAP.ACTIVE;
  const total = r.deal
    ? r.deal.finalPrice
    : r.items.reduce((s, i) => s + i.price * i.quantity, 0);

  // ─── Cancel / Restore ─────────────────────────────

  const openCancelFlow = () => {
    const totalPrepaidCash = r.items.reduce((s, i) => s + (!i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0);
    const totalPrepaidCard = r.items.reduce((s, i) => s + (i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0);
    if (totalPrepaidCash > 0 || totalPrepaidCard > 0) {
      setRetainedCash(totalPrepaidCash);
      setRetainedCard(totalPrepaidCard);
      setCancelModalOpen(true);
    } else {
      handleCancel();
    }
  };

  const handleCancel = async (retainCash?: number, retainCard?: number) => {
    try {
      await recordsApi.cancel(record.id, {
        retainedCashAmount: retainCash,
        retainedCardAmount: retainCard,
      });
      message.success('Запись отменена');
      setCancelModalOpen(false);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleRestore = async () => {
    try {
      await recordsApi.restore(record.id);
      message.success('Запись восстановлена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleDelete = async () => {
    try {
      await recordsApi.delete(record.id);
      message.success('Запись удалена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  const handleSendSms = async (type: 'CAR_READY' | 'REVIEW_REQUEST') => {
    setSmsSending(type);
    try {
      const { result } = await recordsApi.sendSms(record.id, type);
      if (result === 'sent') {
        message.success(type === 'CAR_READY' ? 'SMS «Авто готово» отправлено' : 'SMS запроса отзыва отправлено');
      } else if (result === 'skipped') {
        message.info('Запрос отзыва по этой записи уже отправлялся — повторно не отправляем');
      } else if (result === 'disabled') {
        message.warning('Отправка SMS отключена в настройках');
      } else {
        message.error('Не удалось отправить SMS');
      }
      onRefresh();
    } catch {
      message.error('Не удалось отправить SMS');
    } finally {
      setSmsSending(null);
    }
  };

  // ─── Column definitions ───────────────────────────

  const handleOpenCloseModal = () => {
    const missingEquipment = r.items.filter(i => i.service.hasEquipment && !i.equipmentId);
    if (missingEquipment.length > 0) {
      notify.warning(
        'Необходимо выбрать оборудование',
        `Укажите Bi-Led модуль для: ${missingEquipment.map(i => i.service.name).join(', ')}`,
      );
      return;
    }
    setCloseModalOpen(true);
  };

  const totalPrepaid = r.deal ? 0 : r.items.reduce((s, i) => s + (i.prepaidAmount || 0), 0);

  const viewColumns = [
    {
      title: 'Услуга', key: 'name',
      render: (_: unknown, row: typeof record.items[0]) => {
        const paid = row.prepaidAmount || 0;
        const rowTotal = row.price * row.quantity;
        return (
          <div>
            <div>{row.service.name}</div>
            {!isEmployee && paid > 0 && (
              <Tag
                color={paid >= rowTotal ? 'success' : 'processing'}
                style={{ fontSize: 10, marginTop: 2 }}
              >
                {paid >= rowTotal ? 'Оплачено' : `Предоплата ${formatPrice(paid)}`}
                {row.prepaidByCard ? ' (РС)' : ' (нал)'}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Категория', key: 'cat',
      render: (_: unknown, row: typeof record.items[0]) =>
        <Tag>{row.service.category?.name}</Tag>,
    },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 80 },
    ...(!isEmployee ? [
      {
        title: 'Цена', key: 'price', width: 120,
        render: (_: unknown, row: typeof record.items[0]) => formatPrice(row.price),
      },
      {
        title: 'Итого', key: 'total', width: 120,
        render: (_: unknown, row: typeof record.items[0]) =>
          <strong>{formatPrice(row.price * row.quantity)}</strong>,
      },
    ] : []),
  ];

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={700}
        className={styles.modal}
        classNames={{
          wrapper: styles.modalWrap,
          content: styles.modalContent,
          body: styles.modalBody,
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            Запись #{r.id.slice(-8).toUpperCase()}
            <Tag color={status.color}>{status.label}</Tag>
          </div>
        }
        footer={isMobile ? (
          // ─── Mobile footer ──────────────────────────
          <div className={styles.footerMobile}>
            {(r.status === 'ACTIVE' || r.status === 'CLOSED') && !isEmployee && (
              <div className={styles.footerMobileRow}>
                <Button
                  icon={<CalendarOutlined />}
                  onClick={() => setEditOpen(true)}
                  className={styles.footerMobileFlex}
                >
                  Редактировать
                </Button>
                {r.status === 'ACTIVE' && (
                  <Popconfirm title="Отменить запись?" onConfirm={openCancelFlow} okText="Да" cancelText="Нет">
                    <Button danger icon={<CloseCircleOutlined />} className={styles.footerMobileFlex}>
                      Отменить
                    </Button>
                  </Popconfirm>
                )}
              </div>
            )}
            {r.status === 'ACTIVE' && !isEmployee && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                block
                onClick={handleOpenCloseModal}
              >
                Закрыть сделку
              </Button>
            )}
            {r.status === 'CANCELLED' && !isEmployee && (
              <Popconfirm title="Восстановить запись?" onConfirm={handleRestore} okText="Да" cancelText="Нет">
                <Button type="primary" icon={<ReloadOutlined />} block>Восстановить</Button>
              </Popconfirm>
            )}
            {/* Row 3: SMS иконки + Заявка + Удалить */}
            {!isEmployee && (
              <div className={styles.footerMobileRow}>
                {(r.status === 'ACTIVE' || r.status === 'CLOSED') && (
                  <>
                    <Popconfirm
                      title="Отправить SMS «Авто готово»?"
                      description={`На номер ${r.client.phone}`}
                      onConfirm={() => handleSendSms('CAR_READY')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Button icon={<CarOutlined />} loading={smsSending === 'CAR_READY'} />
                    </Popconfirm>
                    <Popconfirm
                      title="Отправить запрос отзыва?"
                      description={`На номер ${r.client.phone}`}
                      onConfirm={() => handleSendSms('REVIEW_REQUEST')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Button icon={<StarOutlined />} loading={smsSending === 'REVIEW_REQUEST'} />
                    </Popconfirm>
                  </>
                )}
                <Button
                  icon={<PrinterOutlined />}
                  loading={printing}
                  onClick={r.isLegalEntity ? handlePrintContract : handlePrintWorkOrder}
                  className={styles.footerMobileFlex}
                >
                  {r.isLegalEntity ? 'Договор' : 'Заявка'}
                </Button>
                {canDelete && (
                  <Popconfirm
                    title="Удалить запись?"
                    description="Запись и все связанные данные будут удалены безвозвратно."
                    onConfirm={handleDelete}
                    okText="Удалить" okButtonProps={{ danger: true }} cancelText="Отмена"
                  >
                    <Button danger icon={<DeleteOutlined />} className={styles.footerMobileFlex}>
                      Удалить
                    </Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </div>
        ) : (
          // ─── Desktop footer ──────────────────────────
          <div className={styles.footer}>
            <div className={styles.footerDelete}>
              {canDelete && (
                <Popconfirm
                  title="Удалить запись?"
                  description="Запись и все связанные данные будут удалены безвозвратно."
                  onConfirm={handleDelete}
                  okText="Удалить"
                  okButtonProps={{ danger: true }}
                  cancelText="Отмена"
                >
                  <Button danger icon={<DeleteOutlined />}>Удалить</Button>
                </Popconfirm>
              )}
            </div>
            {!isEmployee && (
              <div className={styles.footerSecondary}>
                {(r.status === 'ACTIVE' || r.status === 'CLOSED') && (
                  <>
                    <Popconfirm
                      title="Отправить SMS «Авто готово»?"
                      description={`На номер ${r.client.phone}`}
                      onConfirm={() => handleSendSms('CAR_READY')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Tooltip title="Авто готово">
                        <Button icon={<CarOutlined />} loading={smsSending === 'CAR_READY'} />
                      </Tooltip>
                    </Popconfirm>
                    <Popconfirm
                      title="Отправить запрос отзыва?"
                      description={`На номер ${r.client.phone}`}
                      onConfirm={() => handleSendSms('REVIEW_REQUEST')}
                      okText="Отправить" cancelText="Отмена"
                    >
                      <Tooltip title="Запросить отзыв">
                        <Button icon={<StarOutlined />} loading={smsSending === 'REVIEW_REQUEST'} />
                      </Tooltip>
                    </Popconfirm>
                  </>
                )}
                {r.isLegalEntity ? (
                  <>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintContract}>Договор</Button>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintInvoice}>Счёт</Button>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintAct}>Акт</Button>
                  </>
                ) : (
                  <>
                    <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintWorkOrder}>Заявка</Button>
                    {r.deal && (
                      <Button icon={<PrinterOutlined />} loading={printing} onClick={handlePrintAct}>Акт</Button>
                    )}
                  </>
                )}
              </div>
            )}
            {!isEmployee && (
              <div className={styles.footerPrimary}>
                {(r.status === 'ACTIVE' || r.status === 'CLOSED') && (
                  <Button icon={<CalendarOutlined />} onClick={() => setEditOpen(true)}>Редактировать</Button>
                )}
                {r.status === 'ACTIVE' && (
                  <>
                    <Popconfirm title="Отменить запись?" onConfirm={openCancelFlow} okText="Да" cancelText="Нет">
                      <Button danger icon={<CloseCircleOutlined />}>Отменить</Button>
                    </Popconfirm>
                    <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleOpenCloseModal}>
                      Закрыть сделку
                    </Button>
                  </>
                )}
                {r.status === 'CANCELLED' && (
                  <Popconfirm title="Восстановить запись?" onConfirm={handleRestore} okText="Да" cancelText="Нет">
                    <Button type="primary" icon={<ReloadOutlined />}>Восстановить</Button>
                  </Popconfirm>
                )}
              </div>
            )}
          </div>
        )}
      >
        <Divider orientation="left" style={{ fontSize: 13 }}>Клиент</Divider>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label={r.isLegalEntity ? 'ФИО представителя' : 'ФИО'}>
            <span className={isEmployee ? styles.blurred : undefined}>{r.client.name}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Телефон">
            <span className={isEmployee ? styles.blurred : undefined}>{r.client.phone}</span>
          </Descriptions.Item>
        </Descriptions>

        {/* Сотрудникам данные клиента скрыты, историю им тоже не показываем */}
        {!isEmployee && (
          <Button
            type="link"
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setHistoryOpen(true)}
            className={styles.historyButton}
          >
            История посещений клиента
          </Button>
        )}

        {r.isLegalEntity && !isEmployee && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>Юридическое лицо</Divider>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              {r.legalCompanyName && (
                <Descriptions.Item label="Организация" span={2}>{r.legalCompanyName}</Descriptions.Item>
              )}
              {r.legalAddress && (
                <Descriptions.Item label="Юр. адрес" span={2}>{r.legalAddress}</Descriptions.Item>
              )}
              {r.legalUnp && <Descriptions.Item label="УНП">{r.legalUnp}</Descriptions.Item>}
              {r.legalBic && <Descriptions.Item label="БИК">{r.legalBic}</Descriptions.Item>}
              {r.legalOkpo && <Descriptions.Item label="ОКПО">{r.legalOkpo}</Descriptions.Item>}
              {r.legalPhone && <Descriptions.Item label="Телефон орг.">{r.legalPhone}</Descriptions.Item>}
              {r.legalEmail && <Descriptions.Item label="Email орг.">{r.legalEmail}</Descriptions.Item>}
            </Descriptions>
          </>
        )}

        <Divider orientation="left" style={{ fontSize: 13 }}>Автомобиль</Divider>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Марка / Модель">
            {r.car.brand} {r.car.model}
          </Descriptions.Item>
          <Descriptions.Item label="Год">{r.car.year}</Descriptions.Item>
          {r.car.generationName && (
            <Descriptions.Item label="Поколение">{r.car.generationName}</Descriptions.Item>
          )}
          {r.car.plateNumber && (
            <Descriptions.Item label="Гос. номер">{r.car.plateNumber}</Descriptions.Item>
          )}
        </Descriptions>

        <Divider orientation="left" style={{ fontSize: 13 }}>Запись</Divider>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Принято">{formatDate(r.scheduledAt)}</Descriptions.Item>
          <Descriptions.Item label="Время">{formatTime(r.scheduledAt)}</Descriptions.Item>
          {r.serviceman && (
            <Descriptions.Item label="Сотрудник">{r.serviceman}</Descriptions.Item>
          )}
          {r.receptionist && (
            <Descriptions.Item label="Мастер приёмщик">{r.receptionist}</Descriptions.Item>
          )}
        </Descriptions>

        {r.notes && (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '8px 0' }}>
            📌 {r.notes}
          </p>
        )}

        <Divider orientation="left" style={{ fontSize: 13 }}>Услуги</Divider>
        <Table
          dataSource={r.items}
          columns={viewColumns}
          rowKey="id"
          pagination={false}
          size="small"
          footer={isEmployee ? undefined : () => (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {totalPrepaid > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    <span>Предоплата:</span>
                    <span style={{ color: 'var(--color-status-closed)', fontWeight: 600 }}>− {formatPrice(totalPrepaid)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    <span>Остаток к оплате:</span>
                    <span style={{ fontWeight: 600 }}>{formatPrice(total - totalPrepaid)}</span>
                  </div>
                </>
              )}
              <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 700 }}>
                {r.deal ? 'Итого: ' : 'Предв. итого: '}{formatPrice(total)}
              </div>
            </div>
          )}
        />

        {r.deal && (
          <>
            <Divider orientation="left" style={{ fontSize: 13 }}>Сделка закрыта</Divider>
            <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Выдано">
                {formatDate(r.deal.closedAt)}
              </Descriptions.Item>
              {r.deal.warranty && (
                <Descriptions.Item label="Гарантия">{r.deal.warranty}</Descriptions.Item>
              )}
              {r.deal.priceIncreaseReason && (
                <Descriptions.Item label="Обоснование цены" span={2}>
                  {r.deal.priceIncreaseReason}
                </Descriptions.Item>
              )}
              {r.deal.equipment.length > 0 && (
                <Descriptions.Item label="Bi-Led модули" span={2}>
                  {r.deal.equipment.map(e => e.equipment.name).join(', ')}
                </Descriptions.Item>
              )}
            </Descriptions>
          </>
        )}
      </Modal>

      <RecordModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { onRefresh(); onClose(); }}
        editRecord={r}
        onSavedClosed={r.status === 'CLOSED' ? handleSavedClosed : undefined}
      />

      <CloseRecordModal
        record={(localRecord ?? record)!}
        open={closeModalOpen}
        onClose={() => setCloseModalOpen(false)}
        onSuccess={() => { onRefresh(); onClose(); }}
      />

      {/* Без onSelectRecord — подробности раскрываются внутри панели,
          чтобы не открывать вторую карточку записи поверх текущей */}
      <ClientHistoryDrawer
        clientId={r.clientId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        currentRecordId={r.id}
      />

      <Modal
        open={!!templateModal}
        onCancel={() => setTemplateModal(null)}
        title="Выбор шаблона акта"
        footer={[
          <Button key="cancel" onClick={() => setTemplateModal(null)}>Отмена</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handleTemplateModalPrint}>
            Печатать
          </Button>,
        ]}
        width={480}
      >
        <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
          В записи услуги из разных категорий. Выберите шаблон акта для печати:
        </p>
        <Radio.Group
          value={templateModal?.selectedId}
          onChange={e => setTemplateModal(prev => prev ? { ...prev, selectedId: e.target.value } : prev)}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {templateModal?.templates.map(t => (
            <Radio key={t.id} value={t.id}>
              {t.name}
              {t.isDefault && !t.categoryId && (
                <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>по умолчанию</Tag>
              )}
              {t.category && (
                <Tag style={{ marginLeft: 8, fontSize: 11 }}>{t.category.name}</Tag>
              )}
            </Radio>
          ))}
        </Radio.Group>
      </Modal>

      <Modal
        title="Отмена записи с предоплатой"
        open={cancelModalOpen}
        onCancel={() => setCancelModalOpen(false)}
        onOk={() => handleCancel(retainedCash, retainedCard)}
        okText="Отменить запись"
        okButtonProps={{ danger: true }}
        cancelText="Назад"
        width={400}
      >
        <p style={{ marginBottom: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
          По этой записи есть предоплата. Укажите, какую сумму оставить в кассе.
        </p>
        {r.items.reduce((s, i) => s + (!i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0) > 0 && (
          <Form.Item label="Наличные (оставить в кассе)">
            <InputNumber
              min={0}
              max={r.items.reduce((s, i) => s + (!i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0)}
              value={retainedCash}
              onChange={v => setRetainedCash(v || 0)}
              style={{ width: '100%' }}
              suffix="р."
            />
          </Form.Item>
        )}
        {r.items.reduce((s, i) => s + (i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0) > 0 && (
          <Form.Item label="Безнал РС (оставить в кассе)">
            <InputNumber
              min={0}
              max={r.items.reduce((s, i) => s + (i.prepaidByCard ? (i.prepaidAmount || 0) : 0), 0)}
              value={retainedCard}
              onChange={v => setRetainedCard(v || 0)}
              style={{ width: '100%' }}
              suffix="р."
            />
          </Form.Item>
        )}
      </Modal>
    </>
  );
};
