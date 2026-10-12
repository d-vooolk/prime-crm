import React from 'react';
import { Alert, Button, Spin } from 'antd';
import { ReloadOutlined, VideoCameraOutlined } from '@ant-design/icons';
import cn from 'classnames';
import { useCameraPlayer } from './useCameraPlayer';
import styles from './CameraPage.module.scss';

/** Камера офиса: живое видео (оба объектива — одним кадром) или «офис закрыт» */
export const CameraPage: React.FC = () => {
  const { videoRef, state, error, retry } = useCameraPlayer();
  const isLive = state === 'live';

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Камера</h1>
        <span className={cn(styles.status, { [styles.statusLive]: isLive })}>
          <span className={styles.statusDot} />
          {isLive ? 'В эфире' : 'Не в сети'}
        </span>
      </div>

      {state === 'error' && (
        <Alert
          type="error"
          showIcon
          className={styles.alert}
          message="Не удалось открыть камеру"
          description={error}
          action={<Button size="small" onClick={retry}>Повторить</Button>}
        />
      )}

      <div className={styles.screen}>
        {/* Видео есть в разметке всегда: плеер подключается к нему, как только пошёл поток */}
        <video
          ref={videoRef}
          className={cn(styles.video, { [styles.hidden]: !isLive })}
          muted
          playsInline
          autoPlay
          controls
        />

        {state === 'loading' && <Spin size="large" />}

        {state === 'offline' && (
          <div className={styles.offline}>
            <VideoCameraOutlined className={styles.offlineIcon} />
            <div className={styles.offlineTitle}>Камера выключена — офис закрыт</div>
            <div className={styles.offlineHint}>
              Видео появится само, когда в офисе включат компьютер и камеру
            </div>
            <Button icon={<ReloadOutlined />} onClick={retry}>Проверить сейчас</Button>
          </div>
        )}
      </div>
    </div>
  );
};
