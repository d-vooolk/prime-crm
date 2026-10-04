import React, { useState } from 'react';
import { Button, Input, Modal } from 'antd';
import { securityApi } from '@/api/security.api';
import { useAuthStore } from '@/store/authStore';
import styles from './AidProtocolTab.module.scss';

/**
 * Тревожная кнопка «Протокол AID» (server/src/services/panic.service.ts).
 * На странице и в окнах нет никакого текста — только кнопки и поле PIN.
 * Три подтверждения с кнопкой в разных местах — от случайного нажатия по привычке, затем PIN.
 * Неверный PIN — окно просто закрывается. Сработала — сервер отзывает все сессии,
 * а выход здесь же чистит кеш данных на устройстве (pwa/index.ts).
 */
type Step = 'idle' | 'confirm1' | 'confirm2' | 'confirm3' | 'pin';

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
      if (done) {
        logout();
        return;
      }
      close();
    } catch {
      // Любая ошибка снаружи выглядит так же, как неверный PIN
      close();
    } finally {
      setSending(false);
    }
  };

  const cancel = <Button key="cancel" onClick={close}>Отмена</Button>;

  return (
    <div className={styles.page}>
      <Button type="primary" className={styles.aidButton} onClick={() => setStep('confirm1')}>
        Запустить протокол AID
      </Button>

      {/* 1. Подтверждение справа */}
      <Modal
        open={step === 'confirm1'}
        closable={false}
        onCancel={close}
        footer={
          <div className={styles.footerEnd}>
            {cancel}
            <Button type="primary" danger onClick={() => setStep('confirm2')}>Запустить</Button>
          </div>
        }
      />

      {/* 2. Подтверждение слева */}
      <Modal
        open={step === 'confirm2'}
        closable={false}
        onCancel={close}
        footer={
          <div className={styles.footerStart}>
            <Button type="primary" danger onClick={() => setStep('confirm3')}>Подтвердить</Button>
            {cancel}
          </div>
        }
      />

      {/* 3. Кнопки столбцом, подтверждение снизу */}
      <Modal
        open={step === 'confirm3'}
        closable={false}
        onCancel={close}
        footer={
          <div className={styles.footerStacked}>
            {cancel}
            <Button danger onClick={() => setStep('pin')}>Да, продолжить</Button>
          </div>
        }
      />

      {/* 4. PIN */}
      <Modal
        open={step === 'pin'}
        closable={false}
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
    </div>
  );
};
