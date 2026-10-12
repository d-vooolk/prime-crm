import http from './http';

export interface CameraSession {
  /** Идёт ли сейчас видео из офиса */
  online: boolean;
  /** Токен просмотра: подставляется в адрес видео (плеер не шлёт заголовок Authorization) */
  token: string;
}

export const cameraApi = {
  getSession: () =>
    http.get<{ data: CameraSession }>('/camera/session').then(r => r.data.data),

  /** Адрес HLS-плейлиста для плеера */
  liveUrl: (token: string) => `/api/camera/live/${encodeURIComponent(token)}/index.m3u8`,
};
