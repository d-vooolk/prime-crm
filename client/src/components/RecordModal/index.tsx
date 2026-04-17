import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, message, Form } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { Step1Client } from './steps/Step1Client';
import { Step2Services } from './steps/Step2Services';
import { Step3Summary } from './steps/Step3Summary';
import { RecordFormData, emptyFormData } from './types';
import { recordsApi } from '@/api/records.api';
import { clientsApi } from '@/api/clients.api';
import { printWorkOrder } from '@/utils/print';
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

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!data.clientName || !data.clientPhone) {
        message.warning('Укажите ФИО и телефон клиента');
        return false;
      }
      if (!data.carBrandId || !data.carModelId || !data.carYear) {
        message.warning('Выберите марку, модель и год автомобиля');
        return false;
      }
      if (!data.date || !data.time || !data.serviceman) {
        message.warning('Укажите дату, время и мастера');
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

  const handleSave = async (withPrint = false) => {
    setLoading(true);
    try {
      let clientId = data.clientId;

      // Создаём клиента если нового
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

      // Собираем дату + время
      const [hours, minutes] = data.time.split(':').map(Number);
      const scheduledAt = new Date(data.date);
      scheduledAt.setHours(hours, minutes, 0, 0);

      const record = await recordsApi.create({
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
          plateNumber: data.carPlate,
        },
        scheduledAt: scheduledAt.toISOString(),
        serviceman: data.serviceman,
        notes: data.clientNotes,
        items: data.services.map(s => ({
          serviceId: s.serviceId,
          price: s.price,
          quantity: s.quantity,
        })),
      });

      message.success('Запись создана');

      if (withPrint) {
        printWorkOrder(record);
      }

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
      destroyOnHidden
    >
      <div className={styles.body}>
        <div className={styles.steps}>
          <Steps current={step} items={STEPS} size="small" />
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
              <>
                <Button
                  icon={<PrinterOutlined />}
                  loading={loading}
                  onClick={() => handleSave(true)}
                >
                  Сохранить и распечатать заявку
                </Button>
                <Button type="primary" loading={loading} onClick={() => handleSave(false)}>
                  Сохранить
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
