import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { cameraApi } from '@/api/camera.api';
import { useOnAppResume } from '@/hooks/useAppResume';
import { getErrorMessage } from '@/utils/errors';

/** loading — узнаём состояние; offline — офис закрыт (видео не идёт); live — показываем */
export type CameraState = 'loading' | 'offline' | 'live' | 'error';

// Пока камера выключена — проверяем, не включили ли её
const OFFLINE_POLL_MS = 15_000;

/**
 * Живое видео камеры офиса в <video>. hls.js там, где есть MediaSource (компьютер, Android,
 * новые iPhone), иначе — встроенный HLS Safari. Видео оборвалось — показываем «выключена»
 * и снова ждём включения.
 */
export function useCameraPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pollRef = useRef<number | null>(null);
  // Со страницы ушли, пока шёл запрос, — ответ игнорируем и опрос не запускаем
  const aliveRef = useRef(true);
  const [state, setState] = useState<CameraState>('loading');
  const [error, setError] = useState<string | null>(null);

  const stopPlayer = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const video = videoRef.current;
    if (video) {
      video.onerror = null;
      video.onended = null;
      video.removeAttribute('src');
      video.load();
    }
  }, []);

  const stopPoll = useCallback(() => {
    if (pollRef.current != null) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  }, []);

  const connect = useCallback(async () => {
    stopPoll();
    let session;
    try {
      session = await cameraApi.getSession();
    } catch (e) {
      if (!aliveRef.current) return;
      stopPlayer();
      setError(getErrorMessage(e));
      setState('error');
      return;
    }
    if (!aliveRef.current) return;
    setError(null);

    const video = videoRef.current;
    if (!session.online || !video) {
      stopPlayer();
      setState('offline');
      pollRef.current = window.setTimeout(connect, OFFLINE_POLL_MS);
      return;
    }

    // Видео пропало (офис выключили, обрыв связи) — ждём следующего включения
    const goOffline = () => {
      stopPlayer();
      setState('offline');
      stopPoll();
      pollRef.current = window.setTimeout(connect, OFFLINE_POLL_MS);
    };

    stopPlayer();
    const url = cameraApi.liveUrl(session.token);
    if (Hls.isSupported()) {
      const hls = new Hls({ liveSyncDurationCount: 3, manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2 });
      hlsRef.current = hls;
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) goOffline();
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.onerror = goOffline;
      video.onended = goOffline;
    } else {
      setError('Браузер не умеет показывать видео камеры');
      setState('error');
      return;
    }
    setState('live');
    video.play().catch(() => {
      // Автозапуск без звука браузеры разрешают; если нет — у видео есть кнопка запуска
    });
  }, [stopPlayer, stopPoll]);

  useEffect(() => {
    aliveRef.current = true;
    connect();
    return () => {
      aliveRef.current = false;
      stopPoll();
      stopPlayer();
    };
  }, [connect, stopPlayer, stopPoll]);

  // Вернулись в приложение — переподключаемся: видео в фоне отстало, токен мог устареть
  useOnAppResume(connect);

  return { videoRef, state, error, retry: connect };
}
