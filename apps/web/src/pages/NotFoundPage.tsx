import { Button } from '@lailai/ui';
import { useNavigate } from 'react-router';
import styles from './FeaturePages.module.css';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className={styles.notFound}>
      <strong>404</strong>
      <h1>页面不存在</h1>
      <p>请检查地址，或返回 Academy 首页。</p>
      <Button onClick={() => navigate('/')}>返回首页</Button>
    </main>
  );
}
