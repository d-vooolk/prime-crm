import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, Form, Grid } from 'antd';
import cn from 'classnames';
import dayjs from 'dayjs';
const { useBreakpoint } = Grid;
import { Step1Client } from './steps/Step1Client';
import { Step2Services } from './steps/Step2Services';
import { Step3Summary } from './steps/Step3Summary';
import { RecordFormData, emptyFormData } from './types';
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

function recordToFormData(record: CrmRecord): RecordFormData {
  return {
    clientId: record.clientId,
    clientName: record.client.name,
    clientPhone: record.client.phone,
    clientNotes: record.notes || '',
    carId: record.carId,
    carBrandId: record.car.brandId,
    carBrand: record.car.brand,
    carModelId: record.car.modelId,
    carModel: record.car.model,
    carGenerationId: record.car.generationId || '',
    carGenerationName: record.car.generationName || '',
    carYear: record.car.year,
    carPlateNumber: record.car.plateNumber || '',
    carMileage: record.car.mileage || '',
    date: dayjs(record.scheduledAt).startOf('day').toISOString(),
    time: dayjs(record.scheduledAt).format('HH:mm'),
    serviceman: record.serviceman,
    receptionist: record.receptionist || '',
    isLegalEntity: record.isLegalEntity || false,
    legalCompanyName: record.legalCompanyName || '',
    legalAddress: record.legalAddress || '',
    legalActualAddress: record.legalActualAddress || '',
    legalPostalAddress: record.legalPostalAddress || '',
    legalBankDetails: record.legalBankDetails || '',
    legalBic: record.legalBic || '',
    legalUnp: record.legalUnp || '',
    legalOkpo: record.legalOkpo || '',
    legalPhone: record.legalPhone || '',
    legalEmail: record.legalEmail || '',
    legalRepresentativePosition: record.legalRepresentativePosition || '',
    legalRepresentativePositionGenitive: record.legalRepresentativePositionGenitive || '',
    legalRepresentative: record.legalRepresentative || '',
    legalRepresentativeGenitive: record.legalRepresentativeGenitive || '',
    legalBasis: record.legalBasis || '',
    legalVin: record.legalVin || '',
    legalEndDate: record.legalEndDate || '',
    executorSignatoryName: record.executorSignatoryName || '',
    executorSignatoryNameGenitive: record.executorSignatoryNameGenitive || '',
    executorSignatoryPosition: record.executorSignatoryPosition || '',
    executorSignatoryPositionGenitive: record.executorSignatoryPositionGenitive || '',
    executorSignatoryBasis: record.executorSignatoryBasis || '',
    services: record.items.map(item => ({
      serviceId: item.serviceId,
      serviceName: item.service.name,
      categoryName: item.service.category?.name || '',
      price: item.price,
      quantity: item.quantity,
      estimatedTime: item.service.estimatedTime,
      hasEquipment: item.service.hasEquipment ?? false,
      equipmentId: item.equipmentId ?? undefined,
    })),
  };
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

  const isPhoneValid = (phone: string) => {
    return phone.replace(/\D/g, '').length >= 11;
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      const missing: string[] = [];
      if (!data.clientName) missing.push('ФИО клиента');
      if (!isPhoneValid(data.clientPhone)) missing.push('номер телефона');
      if (!data.carBrandId) missing.push('марка автомобиля');
      if (!data.carModelId) missing.push('модель автомобиля');
      if (!data.carYear) missing.push('год автомобиля');
      if (!data.date) missing.push('дата');
      if (!data.time) missing.push('время');
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

  const buildPayload = (clientId: string) => {
    const [hours, minutes] = data.time.split(':').map(Number);
    const scheduledAt = new Date(data.date);
    scheduledAt.setHours(hours, minutes, 0, 0);
    return {
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
      executorSignatoryName: data.executorSignatoryName,
      executorSignatoryNameGenitive: data.executorSignatoryNameGenitive,
      executorSignatoryPosition: data.executorSignatoryPosition,
      executorSignatoryPositionGenitive: data.executorSignatoryPositionGenitive,
      executorSignatoryBasis: data.executorSignatoryBasis,
      items: data.services.map(s => ({
        serviceId: s.serviceId,
        price: s.price,
        quantity: s.quantity,
        equipmentId: s.equipmentId,
      })),
    };
  };

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
      notify.error(
        editRecord ? 'Ошибка обновления записи' : 'Ошибка создания записи',
        e instanceof Error ? e.message : undefined,
      );
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
