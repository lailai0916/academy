import { useState } from 'react';
import {
  Brand,
  IconButton,
  SiteHeader,
  SkipLink,
  ThemeButton,
  ButtonLink,
  useTheme,
} from '@lailai0916/ui';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from './Icon';
import styles from './PublicHeader.module.css';

export function PublicHeader({ minimal = false }: { minimal?: boolean }) {
  const { loading, user, logout } = useAuth();
  const { resolvedTheme, setPreference } = useTheme();
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
      <SkipLink>跳到主要内容</SkipLink>
      <SiteHeader
        brand={
          <Link to="/" aria-label="Academy 首页">
            <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
          </Link>
        }
        navigation={
          minimal ? undefined : (
            <nav aria-label="官网导航">
              <a href="#architecture">平台结构</a>
              <a href="#method">学习方法</a>
              <a href="#progress">建设进度</a>
            </nav>
          )
        }
        actions={
          <>
            <ThemeButton theme={resolvedTheme} onThemeChange={setPreference} />
            {minimal ? (
              <>
                <ButtonLink to="/" variant="ghost" size="sm">
                  返回首页
                </ButtonLink>
                {user && (
                  <IconButton
                    label="退出登录"
                    size="sm"
                    disabled={loggingOut}
                    onClick={() => void handleLogout()}
                  >
                    <Icon icon="lucide:log-out" />
                  </IconButton>
                )}
              </>
            ) : !loading && user ? (
              <ButtonLink to="/dashboard" variant="primary" size="sm">
                进入学习
              </ButtonLink>
            ) : !loading ? (
              <>
                <ButtonLink to="/login" variant="ghost" size="sm">
                  登录
                </ButtonLink>
                <ButtonLink to="/register" variant="primary" size="sm">
                  邀请码注册
                </ButtonLink>
              </>
            ) : (
              <span className={styles.actionPlaceholder} aria-hidden="true" />
            )}
          </>
        }
      />
    </>
  );
}
