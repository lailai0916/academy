import { ThemeControl } from '@lailai0916/ui';

const labels = { system: '跟随系统', light: '浅色', dark: '深色' };

export function AppearanceControl() {
  return <ThemeControl variant="compact" labels={labels} />;
}
