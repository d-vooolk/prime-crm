import jwt from 'jsonwebtoken';

/**
 * Токен просмотра камеры. Видео (HLS) браузер и iPhone запрашивают сами, без заголовка
 * Authorization, поэтому токен лежит в пути: /api/camera/live/<токен>/index.m3u8.
 * Он годится только для камеры (scope) и живёт несколько часов — обычный токен входа
 * в адресе не светится. Роль и увольнение проверяются при каждом запросе (camera.service.ts).
 */
const SCOPE = 'camera';
export const CAMERA_TOKEN_TTL_SECONDS = 12 * 60 * 60;

export interface CameraClaims {
  /** id сотрудника или мастер-доступа */
  sub: string;
  isMaster: boolean;
  /** Секунды, как в JWT — для отзыва всех сессий */
  iat?: number;
}

export function signCameraToken(user: { id: string; isMaster: boolean }, secret: string): string {
  return jwt.sign({ scope: SCOPE, isMaster: user.isMaster }, secret, {
    subject: user.id,
    expiresIn: CAMERA_TOKEN_TTL_SECONDS,
  });
}

/** null — токен поддельный, просрочен или выдан не для камеры (например, токен входа) */
export function verifyCameraToken(token: string, secret: string): CameraClaims | null {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload !== 'object' || payload.scope !== SCOPE || typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, isMaster: payload.isMaster === true, iat: payload.iat };
  } catch {
    return null;
  }
}

/** Файлы HLS от MediaMTX: плейлисты и сегменты (index.m3u8, video1_stream.m3u8, *_seg12.mp4, init.mp4) */
export function isHlsFileName(name: string): boolean {
  return /^[\w-]{1,100}\.(m3u8|mp4|m4s|ts)$/.test(name);
}
