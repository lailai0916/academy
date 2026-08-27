import { describe, expect, it } from 'vitest';
import { describeUserAgent, maskIpAddress } from '../src/services/auth-sessions.js';

describe('authentication session presentation', () => {
  it('recognises common devices and browsers without exposing the full user agent', () => {
    expect(
      describeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.6 Safari/605.1.15'
      )
    ).toEqual({ deviceType: 'desktop', deviceName: 'Mac', browserName: 'Safari' });
    expect(describeUserAgent('Mozilla/5.0 (iPhone) CriOS/140.0 Mobile Safari/604.1')).toEqual({
      deviceType: 'mobile',
      deviceName: 'iPhone',
      browserName: 'Chrome',
    });
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0) Edg/140.0')).toEqual({
      deviceType: 'desktop',
      deviceName: 'Windows 设备',
      browserName: 'Microsoft Edge',
    });
  });

  it('masks network addresses before returning sessions to the browser', () => {
    expect(maskIpAddress('127.0.0.1')).toBe('本机网络');
    expect(maskIpAddress('154.9.25.247')).toBe('154.9.*.*');
    expect(maskIpAddress('2408:8207:7818:ab10:cc00:4d2:7f1:1')).toBe('2408:8207:7818::');
    expect(maskIpAddress('not-an-address')).toBe('未知网络');
  });
});
