import { Brand } from '@lailai/ui';

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-busy="true">
      <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
      <span className="loading-screen__indicator" aria-hidden="true" />
      <span className="sr-only">正在加载学习平台</span>
    </main>
  );
}
