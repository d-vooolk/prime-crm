import React, { useState } from 'react';
import { Alert, Button } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNotify } from '@/hooks/useNotify';
import { enablePush, getPushDeviceState, isStandalone } from '@/pwa';
import { shouldShowPushPrompt, PUSH_PROMPT_SNOOZE_MS } from '@/utils/pushPrompt';
import styles from './PushPrompt.module.scss';

const SNOOZE_KEY = 'prime-crm-push-prompt-snooze';

const readSnooze = () => {
  const value = Number(localStorage.getItem(SNOOZE_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
};

const isPromptNeeded = () => shouldShowPushPrompt({
  ...getPushDeviceState(),
  standalone: isStandalone(),
  snoozedUntil: readSnooze(),
  now: Date.now(),
});

/**
 * Установленное приложение без уведомлений: предлагаем включить. Системный запрос разрешения
 * браузеры (особенно iPhone) показывают только по нажатию — поэтому плашка, а не включение само по себе.
 * Если разрешение уже есть, подписка включается без плашки (autoEnablePush).
 */
export const PushPrompt: React.FC = () => {
  const notify = useNotify();
  const [visible, setVisible] = useState(isPromptNeeded);
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const enable = async () => {
    setBusy(true);
    try {
      await enablePush();
      notify.toast.success('Уведомления включены');
      setVisible(false);
    } catch (e) {
      notify.error(e, 'Не удалось включить уведомления');
      // Запретили в системном окне — больше не предлагаем, вернуть можно только в настройках телефона
      if (!isPromptNeeded()) setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  const snooze = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + PUSH_PROMPT_SNOOZE_MS));
    setVisible(false);
  };

  return (
    <Alert
      banner
      type="info"
      icon={<BellOutlined />}
      showIcon
      className={styles.banner}
      message="Включите уведомления, чтобы сразу узнавать о новых записях и напоминаниях"
      action={(
        <div className={styles.actions}>
          <Button size="small" type="primary" loading={busy} onClick={enable}>Включить</Button>
          <Button size="small" type="text" onClick={snooze} disabled={busy}>Не сейчас</Button>
        </div>
      )}
    />
  );
};
