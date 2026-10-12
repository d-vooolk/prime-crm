import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { isHlsFileName, signCameraToken, verifyCameraToken } from '../utils/cameraToken';

const SECRET = 'test-secret';

describe('cameraToken', () => {
  it('выданный токен проверяется и несёт сотрудника', () => {
    const token = signCameraToken({ id: 'emp1', isMaster: false }, SECRET);
    expect(verifyCameraToken(token, SECRET)).toMatchObject({ sub: 'emp1', isMaster: false });
  });

  it('токен с чужим секретом не подходит', () => {
    const token = signCameraToken({ id: 'emp1', isMaster: false }, 'other');
    expect(verifyCameraToken(token, SECRET)).toBeNull();
  });

  it('обычный токен входа для камеры не годится', () => {
    const loginToken = jwt.sign({ id: 'emp1', email: 'a@b.by', name: 'A', isMaster: true }, SECRET);
    expect(verifyCameraToken(loginToken, SECRET)).toBeNull();
  });

  it('просроченный токен не подходит', () => {
    const expired = jwt.sign({ scope: 'camera', isMaster: false, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET, { subject: 'emp1' });
    expect(verifyCameraToken(expired, SECRET)).toBeNull();
  });
});

describe('isHlsFileName', () => {
  it('пропускает файлы MediaMTX', () => {
    for (const name of ['index.m3u8', 'video1_stream.m3u8', '0f3a_video1_seg12.mp4', 'init.mp4', 'part3.m4s']) {
      expect(isHlsFileName(name)).toBe(true);
    }
  });

  it('не пропускает пути и чужие расширения', () => {
    for (const name of ['../index.m3u8', 'a/b.mp4', 'index.html', 'v3', '']) {
      expect(isHlsFileName(name)).toBe(false);
    }
  });
});
