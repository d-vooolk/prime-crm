import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, Tag, Grid } from 'antd';
import { Record as CrmRecord } from '@/types';
import { CloseRecordModal } from '../CloseRecordModal';
import { RecordModal } from '../RecordModal';
import { ClientHistoryDrawer } from '../ClientHistoryDrawer';
import { recordsApi } from '@/api/records.api';
import { useAuthStore } from '@/store/authStore';
import { useNotify } from '@/hooks/useNotify';
import { canDeleteRecord, isEmployee as isEmployeeRole } from '@/utils/roles';
import { prepaidByMethod } from './documentTemplates';
import { useRecordPrint } from './useRecordPrint';
import { RecordDetailFooter, SmsKind } from './RecordDetailFooter';
import { RecordInfo } from './RecordInfo';
import { RecordItems } from './RecordItems';
import { DefectsEditor } from './DefectsEditor';
import { ActTemplateModal } from './ActTemplateModal';
import { CancelPrepaidModal } from './CancelPrepaidModal';
import styles from './RecordDetailModal.module.scss';

const { useBreakpoint } = Grid;

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
  const navigate = useNavigate();
  const notify = useNotify();
  const isEmployee = isEmployeeRole(user);
  const canDelete = canDeleteRecord(user);
  const [localRecord, setLocalRecord] = useState(record);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [smsSending, setSmsSending] = useState<SmsKind | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const print = useRecordPrint(localRecord ?? record);

  // Локальную копию сбрасываем при открытии другой записи (по id), а не на каждый новый объект
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
    } catch (e) {
      notify.error(e, 'Не удалось обновить данные записи');
    }
  };

  if (!record) return null;

  const r = localRecord ?? record;
  const status = STATUS_MAP[r.status] || STATUS_MAP.ACTIVE;
  const prepaid = prepaidByMethod(r);

  // ─── Отмена / восстановление / удаление ───────────

  const handleCancel = async (retainCash?: number, retainCard?: number) => {
    try {
      await recordsApi.cancel(record.id, {
        retainedCashAmount: retainCash,
        retainedCardAmount: retainCard,
      });
      notify.toast.success('Запись отменена');
      setCancelModalOpen(false);
      onRefresh();
      onClose();
    } catch (e: unknown) {
      notify.error(e, 'Не удалось отменить запись');
    }
  };

  // С предоплатой сначала спрашиваем, сколько оставить в кассе
  const openCancelFlow = () => {
    if (prepaid.cash > 0 || prepaid.card > 0) setCancelModalOpen(true);
    else handleCancel();
  };

  const handleRestore = async () => {
    try {
      await recordsApi.restore(record.id);
      notify.toast.success('Запись восстановлена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      notify.error(e, 'Не удалось восстановить запись');
    }
  };

  const handleDelete = async () => {
    try {
      await recordsApi.delete(record.id);
      notify.toast.success('Запись удалена');
      onRefresh();
      onClose();
    } catch (e: unknown) {
      notify.error(e, 'Не удалось удалить запись');
    }
  };

  const handleSendSms = async (type: SmsKind) => {
    setSmsSending(type);
    try {
      const { result } = await recordsApi.sendSms(record.id, type);
      if (result === 'sent') {
        notify.toast.success(type === 'CAR_READY' ? 'SMS «Авто готово» отправлено' : 'SMS запроса отзыва отправлено');
      } else if (result === 'skipped') {
        notify.toast.info('Запрос отзыва по этой записи уже отправлялся — повторно не отправляем');
      } else if (result === 'disabled') {
        notify.toast.warning('Отправка SMS отключена в настройках');
      } else {
        notify.toast.error('Не удалось отправить SMS');
      }
      onRefresh();
    } catch (e) {
      notify.error(e, 'Не удалось отправить SMS');
    } finally {
      setSmsSending(null);
    }
  };

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

  // Без поколения открываем вики с выбранной моделью
  const openWiki = () => {
    const params = new URLSearchParams({ mark: r.car.brandId, model: r.car.modelId });
    if (r.car.generationId) params.set('generation', r.car.generationId);
    onClose();
    navigate(`/wiki?${params}`);
  };

  return (
    <>
      <Modal
        open={open}
        onCancel={onClose}
        width={700}
        // iOS Safari (особенно ярлык на главном экране): пока модалка «вырастает» zoom-анимацией
        // через transform, прокручиваемое тело иногда не получает касаний — живым остаётся только
        // футер, пока что-нибудь не перерисует окно. На полноэкранной мобильной модалке анимация не нужна
        transitionName={isMobile ? '' : undefined}
        maskTransitionName={isMobile ? '' : undefined}
        className={styles.modal}
        classNames={{
          wrapper: styles.modalWrap,
          content: styles.modalContent,
          body: styles.modalBody,
        }}
        title={
          <div className={styles.title}>
            Запись #{r.id.slice(-8).toUpperCase()}
            <Tag color={status.color}>{status.label}</Tag>
          </div>
        }
        footer={
          <RecordDetailFooter
            record={r}
            isMobile={isMobile}
            isEmployee={isEmployee}
            canDelete={canDelete}
            smsSending={smsSending}
            printing={print.printing}
            onEdit={() => setEditOpen(true)}
            onCancel={openCancelFlow}
            onCloseDeal={handleOpenCloseModal}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onSendSms={handleSendSms}
            onPrintWorkOrder={print.workOrder}
            onPrintAct={print.act}
            onPrintContract={print.contract}
            onPrintInvoice={print.invoice}
          />
        }
      >
        {/* Недостатки — первым блоком: сотрудник видит поле сразу при открытии записи */}
        <DefectsEditor
          record={r}
          onSaved={fresh => { setLocalRecord(fresh); onRefresh(); }}
        />
        <RecordInfo
          record={r}
          isEmployee={isEmployee}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenWiki={openWiki}
        />
        <RecordItems record={r} isEmployee={isEmployee} />
      </Modal>

      <RecordModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={() => { onRefresh(); onClose(); }}
        editRecord={r}
        onSavedClosed={r.status === 'CLOSED' ? handleSavedClosed : undefined}
      />

      <CloseRecordModal
        record={r}
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

      <ActTemplateModal
        choice={print.templateChoice}
        onSelect={id => print.setTemplateChoice(prev => prev ? { ...prev, selectedId: id } : prev)}
        onCancel={() => print.setTemplateChoice(null)}
        onPrint={print.printChosenAct}
      />

      <CancelPrepaidModal
        open={cancelModalOpen}
        prepaidCash={prepaid.cash}
        prepaidCard={prepaid.card}
        onCancel={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
      />
    </>
  );
};
