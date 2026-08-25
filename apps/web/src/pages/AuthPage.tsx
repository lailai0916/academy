import { useState, type FormEvent } from 'react';
import { Button, Panel, TextField } from '@lailai/ui';
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
      navigate('/dashboard', { replace: true });
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const loginMode = mode === 'login';

  return (
    <div className={styles.page}>
      <PublicHeader minimal />
      <main id="main-content" className={styles.content}>
        <Panel feature className={styles.formPanel}>
          <form className={styles.form} onSubmit={submit}>
            <header className={styles.formHeader}>
              <h1>{loginMode ? '登录' : '邀请码注册'}</h1>
              <p>{loginMode ? '使用用户名和密码登录。' : '填写管理员提供的邀请码。'}</p>
            </header>
            <TextField
              label="用户名"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
            <TextField
              label="密码"
              name="password"
              type="password"
              autoComplete={loginMode ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              description={loginMode ? undefined : '至少 8 个字符。'}
              required
            />
            {!loginMode && (
              <TextField
                label="邀请码"
                name="inviteCode"
                autoComplete="off"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                description="邀请码由 Academy 管理员生成。"
                required
              />
            )}
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="large" disabled={submitting}>
              {submitting ? '正在提交' : loginMode ? '登录' : '注册'}
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
