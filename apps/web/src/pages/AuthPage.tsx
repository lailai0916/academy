import { useEffect, useState, type FormEvent } from 'react';
import { Button, Panel, TextField } from '@lailai0916/ui';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { PublicHeader } from '../components/PublicHeader';
import { errorMessage } from '../lib/api';
import styles from './AuthPage.module.css';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        await register(username, password, inviteCode);
      }
      navigate(mode === 'register' ? '/onboarding' : '/dashboard', { replace: true });
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const loginMode = mode === 'login';
  const title = loginMode ? '登录' : '邀请码注册';

  useEffect(() => {
    document.title = `${title} | lailai's Academy`;
    return () => {
      document.title = "lailai's Academy";
    };
  }, [title]);

  return (
    <div className={styles.page}>
      <PublicHeader minimal />
      <main id="main-content" className={styles.content}>
        <Panel feature className={styles.formPanel}>
          <form className={styles.form} onSubmit={submit} aria-busy={submitting}>
            <header className={styles.formHeader}>
              <h1>{title}</h1>
              <p>{loginMode ? '继续你的学习计划。' : '使用管理员提供的邀请码创建账号。'}</p>
            </header>
            <TextField
              label="用户名"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              minLength={3}
              maxLength={24}
              enterKeyHint="next"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={submitting}
              required
            />
            <TextField
              label="密码"
              name="password"
              type="password"
              autoComplete={loginMode ? 'current-password' : 'new-password'}
              minLength={loginMode ? 1 : 8}
              maxLength={128}
              enterKeyHint={loginMode ? 'done' : 'next'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              description={loginMode ? undefined : '至少 8 个字符。'}
              disabled={submitting}
              required
            />
            {!loginMode && (
              <TextField
                label="邀请码"
                name="inviteCode"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                minLength={8}
                maxLength={64}
                enterKeyHint="done"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                description="由 Academy 管理员生成，大小写不敏感。"
                disabled={submitting}
                required
              />
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Button variant="primary" type="submit" size="lg" fullWidth disabled={submitting}>
              {submitting ? (loginMode ? '正在登录…' : '正在注册…') : loginMode ? '登录' : '注册'}
            </Button>
            <p className={styles.switchMode}>
              <Link to={loginMode ? '/register' : '/login'}>
                {loginMode ? '使用邀请码注册' : '已有账号，返回登录'}
              </Link>
            </p>
          </form>
        </Panel>
      </main>
    </div>
  );
}
