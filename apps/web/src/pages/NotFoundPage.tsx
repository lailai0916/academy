import { Button } from '@lailai/ui';
import { useNavigate } from 'react-router';
import styles from './FeaturePages.module.css';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className={styles.notFound}>
      <strong>404</strong>
      <h1>这里没有学习任务。</h1>
      <p>这个地址不存在，返回今天的计划继续学习吧。</p>
      <Button onClick={() => navigate('/')}>返回首页</Button>
    </main>
  );
}
