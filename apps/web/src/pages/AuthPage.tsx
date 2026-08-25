import { useState, type FormEvent } from 'react';
import { Icon } from '@iconify/react';
import { Brand, Button, Panel, TextField } from '@lailai/ui';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
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
      navigate('/', { replace: true });
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const loginMode = mode === 'login';

  return (
    <main className={styles.page}>
      <section className={styles.intro}>
        <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>高中 AI 自学平台</p>
          <h1>把每一次练习，变成可验证的长期掌握。</h1>
          <p>
            围绕教材、考试和长期记忆制定每日计划。平台根据你的回答、延迟测试和遗忘状态持续调整下一步。
          </p>
        </div>
        <ul className={styles.features}>
          <li>
            <Icon icon="lucide:brain" />
            <span>
              <strong>自适应记忆</strong>
              <small>按掌握度安排单词和古诗词复习</small>
            </span>
          </li>
          <li>
            <Icon icon="lucide:target" />
            <span>
              <strong>面向考试</strong>
              <small>用延迟正确率检验真实学习结果</small>
            </span>
          </li>
          <li>
            <Icon icon="lucide:sparkles" />
            <span>
              <strong>AI 讲解</strong>
              <small>根据当前错误生成讲解和变式练习</small>
            </span>
          </li>
        </ul>
      </section>

      <Panel feature className={styles.formPanel}>
        <form className={styles.form} onSubmit={submit}>
          <header className={styles.formHeader}>
            <h2>{loginMode ? '登录 Academy' : '使用邀请码注册'}</h2>
            <p>{loginMode ? '继续今天的学习计划。' : '创建只属于你的学习档案。'}</p>
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
            {submitting ? '正在提交' : loginMode ? '登录' : '注册并开始诊断'}
          </Button>
          <p className={styles.switchMode}>
            {loginMode ? '还没有账号？' : '已经有账号？'}{' '}
            <Link to={loginMode ? '/register' : '/login'}>
              {loginMode ? '使用邀请码注册' : '返回登录'}
            </Link>
          </p>
        </form>
      </Panel>
    </main>
  );
}
