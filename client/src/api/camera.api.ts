import http from './http';

export interface CameraSession {
  /** Идёт ли сейчас видео из офиса */
  online: boolean;
  /** Токен просмотра: подставляется в адрес видео (плеер не шлёт заголовок Authorization) */
  token: string;
}

/** Промежуток, за который в архиве есть запись (ISO) */
export interface CameraArchiveRange {
  start: string;
  end: string;
}

export const cameraApi = {
  getSession: () =>
    http.get<{ data: CameraSession }>('/camera/session').then(r => r.data.data),

  getArchive: () =>
    http.get<{ data: CameraArchiveRange[] }>('/camera/archive').then(r => r.data.data),

  /** Адрес HLS-плейлиста для плеера */
  liveUrl: (token: string) => `/api/camera/live/${encodeURIComponent(token)}/index.m3u8`,

  /** Промежуток архива одним MP4: inline — смотреть в браузере, иначе — скачать */
  archiveFileUrl: (token: string, start: string, end: string, inline = false) => {
    const params = new URLSearchParams({ start, end, ...(inline ? { inline: '1' } : {}) });
    return `/api/camera/archive-file/${encodeURIComponent(token)}/camera.mp4?${params}`;
  },
};
