import React, { useEffect, useState } from 'react';
import { Alert, Button, Modal, Switch } from 'antd';
import { BellOutlined, DownloadOutlined, MobileOutlined } from '@ant-design/icons';
import { usePwaStore } from '@/store/pwaStore';
import { pushApi } from '@/api/push.api';
import { useNotify } from '@/hooks/useNotify';
import { readNavLog } from '@/hooks/useNotificationNavigation';
import {
  disablePush, enablePush, getPushSubscription, isIos, isPushEnabledHere, isPushSupported, isStandalone, promptInstall,
} from '@/pwa';
import styles from './AppDeviceSettings.module.scss';

/**
 * Настройки этого устройства: установка CRM как приложения и пуш-уведомления.
 * Уведомления: новая запись — мастеру, «заканчивается на складе» — менеджерам, напоминания заметок.
 */
export const AppDeviceSettings: React.FC = () => {
  const notify = useNotify();
  const installPrompt = usePwaStore(s => s.installPrompt);
  const [pushOn, setPushOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [navLog, setNavLog] = useState<string[] | null>(null);
  const standalone = isStandalone();
  const ios = isIos();

  useEffect(() => {
    // Подписка могла пропасть (сбросили разрешение в браузере) — показываем реальное состояние
    getPushSubscription()
      .then(sub => setPushOn(!!sub && isPushEnabledHere()))
      .catch(() => setPushOn(false));
  }, []);

  const togglePush = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        await enablePush();
        notify.toast.success('Уведомления включены на этом устройстве');
      } else {
        await disablePush();
      }
      setPushOn(on);
    } catch (e) {
      notify.error(e, on ? 'Не удалось включить уведомления' : 'Не удалось выключить уведомления');
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    try {
      await pushApi.test();
      notify.toast.success('Уведомление придёт через 5 секунд — сверните приложение и нажмите на него, откроется расписание');
    } catch (e) {
      notify.error(e, 'Не удалось отправить уведомление');
    }
  };

  const showNavLog = () => {
    setNavLog(readNavLog());
  };

  const copyNavLog = () => {
    navigator.clipboard.writeText((navLog ?? []).join('\n'))
      .then(() => notify.toast.success('Журнал скопирован'))
      .catch(e => notify.error(e, 'Не удалось скопировать'));
  };

  const install = async () => {
    if (await promptInstall()) notify.toast.success('Приложение установлено');
  };

  return (
    <>
      <div className={styles.row}>
        <div>
          <div className={styles.label}><MobileOutlined /> Приложение на телефоне</div>
          <div className={styles.hint}>
            {standalone
              ? 'CRM открыта как установленное приложение'
              : 'Иконка на главном экране, открывается без браузера, работает быстрее'}
          </div>
        </div>
        {!standalone && installPrompt && (
          <Button icon={<DownloadOutlined />} onClick={install}>Установить</Button>
        )}
      </div>
      {!standalone && !installPrompt && (
        <Alert
          className={styles.howto}
          type="info"
          showIcon
          message={ios
            ? 'iPhone: откройте CRM в Safari → кнопка «Поделиться» → «На экран Домой»'
            : 'Android: меню браузера Chrome (⋮) → «Установить приложение» или «Добавить на главный экран»'}
        />
      )}

      <div className={styles.row}>
        <div>
          <div className={styles.label}><BellOutlined /> Уведомления на этом устройстве</div>
          <div className={styles.hint}>Новые записи, напоминания заметок, заканчивающиеся товары на складе</div>
        </div>
        <div className={styles.actions}>
          {pushOn && <Button size="small" onClick={showNavLog}>Журнал</Button>}
          {pushOn && <Button size="small" onClick={sendTest}>Проверить</Button>}
          <Switch checked={pushOn} loading={busy} onChange={togglePush} disabled={!isPushSupported() && !ios} />
        </div>
      </div>
      <Modal
        title="Журнал уведомлений"
        open={!!navLog}
        onCancel={() => setNavLog(null)}
        footer={<Button onClick={copyNavLog}>Скопировать</Button>}
      >
        <pre className={styles.log}>{navLog?.length ? navLog.join('\n') : 'Пусто'}</pre>
      </Modal>
      {ios && !standalone && (
        <div className={styles.note}>На iPhone уведомления работают только в установленном приложении (iOS 16.4 и новее).</div>
      )}
    </>
  );
};
