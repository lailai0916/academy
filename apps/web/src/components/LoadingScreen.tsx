import { Brand, Skeleton } from '@lailai0916/ui';

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
      <Skeleton width={100} height={20} />
      <span className="sr-only">正在加载学习平台</span>
    </main>
  );
}
