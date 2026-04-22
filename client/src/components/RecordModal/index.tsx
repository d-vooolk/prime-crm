import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, message, Form, Grid } from 'antd';
import cn from 'classnames';
const { useBreakpoint } = Grid;
import { Step1Client } from './steps/Step1Client';
import { Step2Services } from './steps/Step2Services';
import { Step3Summary } from './steps/Step3Summary';
import { RecordFormData, emptyFormData } from './types';
import { recordsApi } from '@/api/records.api';
import { clientsApi } from '@/api/clients.api';
import styles from './RecordModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialDate?: string;
}

const STEPS = [
  { title: 'Клиент и авто' },
  { title: 'Услуги' },
  { title: 'Итог' },
];

export const RecordModal: React.FC<Props> = ({ open, onClose, onSuccess, initialDate }) => {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RecordFormData>({
    ...emptyFormData,
    date: initialDate || '',
  });

  useEffect(() => {
    if (open) {
      setData({ ...emptyFormData, date: initialDate || '' });
      setStep(0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (partial: Partial<RecordFormData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const handleClose = () => {
    setData({ ...emptyFormData, date: initialDate || '' });
    setStep(0);
    onClose();
  };

  const isPhoneValid = (phone: string) => {
    return phone.replace(/\D/g, '').length >= 11;
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!data.clientName || !isPhoneValid(data.clientPhone)) {
        message.warning('Укажите ФИО и полный номер телефона клиента');
        return false;
      }
      if (!data.carBrandId || !data.carModelId || !data.carYear) {
        message.warning('Выберите марку, модель и год автомобиля');
        return false;
      }
      if (!data.date || !data.time) {
        message.warning('Укажите дату и время');
        return false;
      }
    }
    if (step === 1 && data.services.length === 0) {
      message.warning('Добавьте хотя бы одну услугу');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep(s => s + 1);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
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

      const [hours, minutes] = data.time.split(':').map(Number);
      const scheduledAt = new Date(data.date);
      scheduledAt.setHours(hours, minutes, 0, 0);

      await recordsApi.create({
        clientId,
        car: {
          brand: data.carBrand,
          brandId: data.carBrandId,
          model: data.carModel,
          modelId: data.carModelId,
          generation: data.carGenerationName,
          generationId: data.carGenerationId,
          generationName: data.carGenerationName,
          year: data.carYear,
          plateNumber: data.carPlateNumber,
          mileage: data.carMileage,
        },
        scheduledAt: scheduledAt.toISOString(),
        serviceman: data.serviceman,
        receptionist: data.receptionist,
        notes: data.clientNotes,
        isLegalEntity: data.isLegalEntity,
        legalCompanyName: data.legalCompanyName,
        legalAddress: data.legalAddress,
        legalActualAddress: data.legalActualAddress,
        legalPostalAddress: data.legalPostalAddress,
        legalBankDetails: data.legalBankDetails,
        legalBic: data.legalBic,
        legalUnp: data.legalUnp,
        legalOkpo: data.legalOkpo,
        legalPhone: data.legalPhone,
        legalEmail: data.legalEmail,
        legalRepresentativePosition: data.legalRepresentativePosition,
        legalRepresentativePositionGenitive: data.legalRepresentativePositionGenitive,
        legalRepresentative: data.legalRepresentative,
        legalRepresentativeGenitive: data.legalRepresentativeGenitive,
        legalBasis: data.legalBasis,
        legalVin: data.legalVin,
        legalEndDate: data.legalEndDate,
        items: data.services.map(s => ({
          serviceId: s.serviceId,
          price: s.price,
          quantity: s.quantity,
        })),
      });

      message.success('Запись создана');
      onSuccess();
      handleClose();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Ошибка создания записи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title="Новая запись"
      width={800}
      footer={null}
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
              {STEPS.map((s, i) => (
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
          {step === 1 && <Step2Services data={data} onChange={handleChange} />}
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
