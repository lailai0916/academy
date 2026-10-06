import { Component, type ReactNode } from 'react';
import { Button, DataState } from '@lailai0916/ui';

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <DataState
        message="页面加载失败，请重新加载后重试。"
        action={<Button onClick={() => window.location.reload()}>重新加载</Button>}
      />
    ) : (
      this.props.children
    );
  }
}
