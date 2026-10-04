import React, { useState } from 'react';
import { Button, Card, Input, Modal, Typography } from 'antd';
import { securityApi } from '@/api/security.api';
import { useAuthStore } from '@/store/authStore';
import styles from './AidProtocolTab.module.scss';

const { Paragraph } = Typography;

/**
 * Тревожная кнопка «Протокол AID» (server/src/services/panic.service.ts).
 * Три подтверждения с кнопкой в разных местах — от случайного нажатия по привычке, затем PIN.
 * Неверный PIN выглядит как «протокол недоступен». Сработала — сервер отзывает все сессии,
 * а выход здесь же чистит кеш данных на устройстве (pwa/index.ts).
 */
type Step = 'idle' | 'confirm1' | 'confirm2' | 'confirm3' | 'pin' | 'empty';

export const AidProtocolTab: React.FC = () => {
  const logout = useAuthStore(s => s.logout);
  const [step, setStep] = useState<Step>('idle');
  const [pin, setPin] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    setStep('idle');
    setPin('');
  };

  const submitPin = async () => {
    if (!pin.trim() || sending) return;
    setSending(true);
    try {
      const { done } = await securityApi.hiddenRecords(pin.trim());
      setPin('');
      if (done) {
        logout();
        return;
      }
      setStep('empty');
    } catch {
      // Любая ошибка снаружи выглядит так же, как неверный PIN
      setPin('');
      setStep('empty');
    } finally {
      setSending(false);
    }
  };

  const cancel = <Button key="cancel" onClick={close}>Отмена</Button>;

  return (
    <Card title="Протокол AID">
      <Paragraph type="secondary">
        Шифрование данных и очистка базы. Восстановление — только ключом владельца.
      </Paragraph>
      <Button type="primary" size="large" className={styles.aidButton} onClick={() => setStep('confirm1')}>
        Запустить протокол AID
      </Button>

      {/* 1. Подтверждение справа */}
      <Modal
        open={step === 'confirm1'}
        title="Запустить протокол AID?"
        onCancel={close}
        footer={
          <div className={styles.footerEnd}>
            {cancel}
            <Button type="primary" danger onClick={() => setStep('confirm2')}>Запустить</Button>
          </div>
        }
      >
        <Paragraph>Данные будут зашифрованы, база очищена.</Paragraph>
      </Modal>

      {/* 2. Подтверждение слева */}
      <Modal
        open={step === 'confirm2'}
        title="Подтвердите действие"
        onCancel={close}
        footer={
          <div className={styles.footerStart}>
            <Button type="primary" danger onClick={() => setStep('confirm3')}>Подтвердить</Button>
            {cancel}
          </div>
        }
      >
        <Paragraph>Вы уверены?</Paragraph>
      </Modal>

      {/* 3. Кнопки столбцом, подтверждение снизу */}
      <Modal
        open={step === 'confirm3'}
        title="Последнее подтверждение"
        onCancel={close}
        footer={
          <div className={styles.footerStacked}>
            {cancel}
            <Button danger onClick={() => setStep('pin')}>Да, продолжить</Button>
          </div>
        }
      >
        <Paragraph>Подтвердите ещё раз.</Paragraph>
      </Modal>

      {/* 4. PIN */}
      <Modal
        open={step === 'pin'}
        title="Введите PIN"
        onCancel={close}
        destroyOnHidden
        footer={
          <div className={styles.footerEnd}>
            {cancel}
            <Button type="primary" danger loading={sending} disabled={!pin.trim()} onClick={submitPin}>Запустить</Button>
          </div>
        }
      >
        <Input.Password
          autoFocus
          autoComplete="off"
          value={pin}
          onChange={e => setPin(e.target.value)}
          onPressEnter={submitPin}
          maxLength={100}
        />
      </Modal>

      <Modal
        open={step === 'empty'}
        title="Протокол AID"
        onCancel={close}
        footer={<Button type="primary" onClick={close}>Закрыть</Button>}
      >
        <Paragraph>Протокол недоступен.</Paragraph>
      </Modal>
    </Card>
  );
};
