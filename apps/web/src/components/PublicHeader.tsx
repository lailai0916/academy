import { useState } from 'react';
import { Brand, IconButton, ThemeControl } from '@lailai/ui';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from './Icon';
import styles from './PublicHeader.module.css';

export function PublicHeader({ minimal = false }: { minimal?: boolean }) {
  const { loading, user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <header className={styles.header}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand} aria-label="Academy 首页">
            <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
          </Link>

          {!minimal && (
            <nav className={styles.navigation} aria-label="官网导航">
              <a href="#system">学习系统</a>
              <a href="#method">学习方法</a>
              <a href="#community">学习社区</a>
            </nav>
          )}

          <div className={styles.actions}>
            <ThemeControl
              variant="compact"
              labels={{ system: '跟随系统', light: '浅色', dark: '深色' }}
            />
            {minimal ? (
              <>
                <Link to="/" className={styles.textAction}>
                  返回首页
                </Link>
                {user && (
                  <IconButton
                    label="退出登录"
                    size="small"
                    disabled={loggingOut}
                    onClick={() => void handleLogout()}
                  >
                    <Icon icon="lucide:log-out" />
                  </IconButton>
                )}
              </>
            ) : !loading && user ? (
              <Link to="/dashboard" className={styles.primaryAction}>
                进入学习
              </Link>
            ) : !loading ? (
              <>
                <Link to="/login" className={styles.textAction}>
                  登录
                </Link>
                <Link to="/register" className={styles.primaryAction}>
                  邀请码注册
                </Link>
              </>
            ) : (
              <span className={styles.actionPlaceholder} aria-hidden="true" />
            )}
          </div>
        </div>
      </header>
    </>
  );
}
