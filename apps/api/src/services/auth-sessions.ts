import type { AuthSession } from '@lailai/academy-shared';

type DeviceDetails = Pick<AuthSession, 'deviceType' | 'deviceName' | 'browserName'>;

export function describeUserAgent(userAgent: string): DeviceDetails {
  const normalized = userAgent.toLowerCase();
  const deviceType: AuthSession['deviceType'] = /ipad|tablet/.test(normalized)
    ? 'tablet'
    : /iphone|android.*mobile/.test(normalized)
      ? 'mobile'
      : /macintosh|windows|linux|cros/.test(normalized)
        ? 'desktop'
        : 'unknown';
  const deviceName = /ipad/.test(normalized)
    ? 'iPad'
    : /iphone/.test(normalized)
      ? 'iPhone'
      : /android/.test(normalized)
        ? 'Android 设备'
        : /macintosh/.test(normalized)
          ? 'Mac'
          : /windows/.test(normalized)
            ? 'Windows 设备'
            : /cros/.test(normalized)
              ? 'Chromebook'
              : /linux/.test(normalized)
                ? 'Linux 设备'
                : '未知设备';
  const browserName = /edg\//.test(normalized)
    ? 'Microsoft Edge'
    : /firefox\//.test(normalized)
      ? 'Firefox'
      : /crios\//.test(normalized)
        ? 'Chrome'
        : /chrome\//.test(normalized)
          ? 'Chrome'
          : /safari\//.test(normalized)
            ? 'Safari'
            : '未知浏览器';

  return { deviceType, deviceName, browserName };
}

export function maskIpAddress(ipAddress: string) {
  if (ipAddress === '127.0.0.1' || ipAddress === '::1') return '本机网络';
  if (ipAddress.includes('.')) {
    const segments = ipAddress.split('.');
    if (segments.length === 4) return `${segments[0]}.${segments[1]}.*.*`;
  }
  if (ipAddress.includes(':')) {
    const segments = ipAddress.split(':').filter(Boolean);
    return `${segments.slice(0, 3).join(':')}::`;
  }
  return '未知网络';
}
