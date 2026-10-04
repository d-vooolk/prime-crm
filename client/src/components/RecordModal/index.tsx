import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, Form, Grid } from 'antd';
import cn from 'classnames';
const { useBreakpoint } = Grid;
import { Step1Client } from './steps/Step1Client';
import { Step2Services } from './steps/Step2Services';
import { Step3Summary } from './steps/Step3Summary';
import { RecordFormData, emptyFormData } from './types';
import { buildRecordPayload, missingClientFields, recordToFormData } from './recordForm';
import { recordsApi } from '@/api/records.api';
import { clientsApi } from '@/api/clients.api';
import { useNotify } from '@/hooks/useNotify';
import { Record as CrmRecord } from '@/types';
import styles from './RecordModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
  editRecord?: CrmRecord;
  onSavedClosed?: () => void;
}

const STEPS = [
  { title: 'Клиент и авто' },
  { title: 'Услуги' },
  { title: 'Итог' },
];

export const RecordModal: React.FC<Props> = ({ open, onClose, onSuccess, initialDate, editRecord, onSavedClosed }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const notify = useNotify();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecordFormData>({
    ...emptyFormData,
    date: initialDate || '',
  });

  useEffect(() => {
    if (open) {
      setData(editRecord ? recordToFormData(editRecord) : { ...emptyFormData, date: initialDate || '' });
      setStep(0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (partial: Partial<RecordFormData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const handleClose = () => {
    setData(editRecord ? recordToFormData(editRecord) : { ...emptyFormData, date: initialDate || '' });
    setStep(0);
    onClose();
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      const missing = missingClientFields(data);
      if (missing.length > 0) {
        notify.warning(
          'Заполните обязательные поля',
          `Требуется указать: ${missing.join(', ')}`,
        );
        return false;
      }
    }
    if (step === 1 && data.services.length === 0) {
      notify.warning('Выберите услуги', 'Добавьте хотя бы одну услугу перед переходом к итогу');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const buildPayload = (clientId: string) => buildRecordPayload(data, clientId);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (editRecord) {
        await clientsApi.update(editRecord.clientId, {
          name: data.clientName,
          phone: data.clientPhone,
        });
        await recordsApi.update(editRecord.id, buildPayload(editRecord.clientId));
        if (editRecord.status === 'CLOSED' && onSavedClosed) {
          handleClose();
          onSavedClosed();
          return;
        }
        notify.success('Запись обновлена');
      } else {
        let clientId = data.clientId;
        if (!clientId) {
          const existing = await clientsApi.searchByPhone(data.clientPhone);
          if (existing.length > 0) {
            clientId = existing[0].id;
          } else {
            const created = await clientsApi.create({
              name: data.clientName,
              phone: data.clientPhone,
              notes: data.clientNotes,
            });
            clientId = created.id;
          }
        }
        await recordsApi.create(buildPayload(clientId));
        notify.success('Запись создана');
      }
      onSuccess();
      handleClose();
    } catch (e: unknown) {
      notify.error(e, editRecord ? 'Ошибка обновления записи' : 'Ошибка создания записи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={editRecord ? 'Редактировать запись' : 'Новая запись'}
      width={800}
      footer={null}
      transitionName={isMobile ? '' : undefined}
      maskTransitionName={isMobile ? '' : undefined}
      className={styles.modal}
      classNames={{
        wrapper: styles.modalWrap,
        content: styles.modalContent,
        body: styles.modalBody,
      }}
      destroyOnHidden
    >
      <div className={styles.body}>
        <div className={styles.steps}>
          {isMobile ? (
            <div className={styles.mobileSteps}>
              {STEPS.map((_s, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <div className={cn(styles.mobileStepLine, { [styles.mobileStepLineDone]: step >= i })} />
                  )}
                  <div className={cn(styles.mobileStepDot, {
                    [styles.mobileStepDotActive]: step === i,
                    [styles.mobileStepDotDone]: step > i,
                  })}>
                    {step > i ? '✓' : i + 1}
                  </div>
                </React.Fragment>
              ))}
              <span className={styles.mobileStepTitle}>{STEPS[step].title}</span>
            </div>
          ) : (
            <Steps current={step} items={STEPS} size="small" />
          )}
        </div>

        <Form layout="vertical" className={styles.content}>
          {step === 0 && <Step1Client data={data} onChange={handleChange} />}
          {step === 1 && <Step2Services data={data} onChange={handleChange} prepaymentLocked={editRecord?.status === 'CLOSED'} />}
          {step === 2 && <Step3Summary data={data} />}
        </Form>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {step > 0 && (
              <Button onClick={() => setStep(s => s - 1)}>Назад</Button>
            )}
          </div>
          <div className={styles.footerRight}>
            {step < 2 ? (
              <Button type="primary" onClick={handleNext}>
                Далее
              </Button>
            ) : (
              <Button type="primary" loading={loading} onClick={handleSave}>
                Сохранить
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
