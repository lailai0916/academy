import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Panel, SelectField, TextAreaField, TextField } from '@lailai/ui';
import type { AuthSession, Grade, Profile } from '@lailai/academy-shared';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './FeaturePages.module.css';

const sessionIcons: Record<AuthSession['deviceType'], string> = {
  desktop: 'lucide:monitor',
  mobile: 'lucide:smartphone',
  tablet: 'lucide:tablet',
  unknown: 'lucide:circle-help',
};

function formatSessionTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function SettingsPage() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);
  const securityBusy = passwordSaving || sessionBusy;

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const result = await api<{ sessions: AuthSession[] }>('/auth/sessions');
      setSessions(result.sessions);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    api<{ profile: Profile }>('/profile/me')
      .then((result) => setProfile(result.profile))
      .catch((nextError) => setError(errorMessage(nextError)));
    loadSessions().catch((nextError) => setSecurityError(errorMessage(nextError)));
  }, [loadSessions]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{ profile: Profile }>('/profile/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: profile.displayName,
          bio: profile.bio,
          grade: profile.grade,
          targetScore: profile.targetScore,
          dailyGoal: profile.dailyGoal,
          isPublic: profile.isPublic,
        }),
      });
      setProfile(result.profile);
      await refresh();
      setMessage('个人设置已保存。');
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setSaving(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (securityBusy) return;
    setSecurityError('');
    setSecurityMessage('');
    if (newPassword !== confirmPassword) {
      setSecurityError('两次输入的新密码不一致。');
      return;
    }
    if (currentPassword === newPassword) {
      setSecurityError('新密码需要与当前密码不同。');
      return;
    }
    setPasswordSaving(true);
    try {
      const result = await api<{ otherSessionsRevoked: number }>('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await loadSessions();
      setSecurityMessage(
        result.otherSessionsRevoked > 0 ? '密码已更新，其他设备已退出登录。' : '密码已更新。'
      );
    } catch (nextError) {
      setSecurityError(errorMessage(nextError));
    } finally {
      setPasswordSaving(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (securityBusy) return;
    setSessionBusy(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      await api(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
      await loadSessions();
      setSecurityMessage('该设备已退出登录。');
    } catch (nextError) {
      setSecurityError(errorMessage(nextError));
    } finally {
      setSessionBusy(false);
    }
  };

  const revokeOtherSessions = async () => {
    if (securityBusy) return;
    setSessionBusy(true);
    setSecurityError('');
    setSecurityMessage('');
    try {
      const result = await api<{ revoked: number }>('/auth/sessions/revoke-others', {
        method: 'POST',
      });
      await loadSessions();
      setSecurityMessage(result.revoked > 0 ? '其他设备已全部退出登录。' : '没有其他登录设备。');
    } catch (nextError) {
      setSecurityError(errorMessage(nextError));
    } finally {
      setSessionBusy(false);
    }
  };

  if (!profile && !error) return <div className={page.empty}>正在载入设置……</div>;

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <h1 className={page.pageHeading}>设置</h1>
      </header>
      {!profile && error && <p className={page.error}>{error}</p>}
      {profile && (
        <div className={styles.settingsStack}>
          <Panel feature>
            <form className={styles.adminSection} onSubmit={submit}>
              <div className={page.panelTitle}>
                <div className={page.panelTitleCopy}>
                  <h2>个人资料与学习目标</h2>
                </div>
              </div>
              {error && <p className={page.error}>{error}</p>}
              {message && (
                <p className={page.success} role="status">
                  {message}
                </p>
              )}
              <div className={page.formRow}>
                <TextField
                  label="显示名称"
                  value={profile.displayName}
                  maxLength={24}
                  onChange={(event) => update('displayName', event.target.value)}
                  required
                />
                <SelectField
                  label="当前年级"
                  value={profile.grade}
                  onChange={(event) => update('grade', event.target.value as Grade)}
                >
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                </SelectField>
              </div>
              <TextAreaField
                label="个人简介"
                value={profile.bio}
                maxLength={160}
                onChange={(event) => update('bio', event.target.value)}
              />
              <div className={page.formRow}>
                <TextField
                  label="高考总分目标"
                  type="number"
                  min={0}
                  max={750}
                  value={profile.targetScore}
                  onChange={(event) => update('targetScore', Number(event.target.value))}
                />
                <TextField
                  label="每日学习项目数"
                  type="number"
                  min={5}
                  max={100}
                  value={profile.dailyGoal}
                  onChange={(event) => update('dailyGoal', Number(event.target.value))}
                />
              </div>
              <SelectField
                label="个人主页可见性"
                value={profile.isPublic ? 'public' : 'private'}
                onChange={(event) => update('isPublic', event.target.value === 'public')}
              >
                <option value="public">平台用户可见</option>
                <option value="private">仅自己可见</option>
              </SelectField>
              <div className={page.actions}>
                <Button type="submit" disabled={saving}>
                  {saving ? '正在保存' : '保存设置'}
                </Button>
              </div>
            </form>
          </Panel>

          <Panel>
            <section className={styles.securitySection}>
              <div className={page.panelTitle}>
                <div className={page.panelTitleCopy}>
                  <h2>账号安全</h2>
                </div>
                {sessions.some((session) => !session.current) && (
                  <Button
                    type="button"
                    variant="quiet"
                    size="small"
                    disabled={securityBusy}
                    onClick={revokeOtherSessions}
                  >
                    退出其他设备
                  </Button>
                )}
              </div>
              {securityError && <p className={page.error}>{securityError}</p>}
              {securityMessage && (
                <p className={page.success} role="status">
                  {securityMessage}
                </p>
              )}
              <div className={styles.securityGrid}>
                <form className={styles.passwordForm} onSubmit={submitPassword}>
                  <h3>修改密码</h3>
                  <TextField
                    label="当前密码"
                    type="password"
                    value={currentPassword}
                    autoComplete="current-password"
                    maxLength={128}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                  />
                  <TextField
                    label="新密码"
                    type="password"
                    value={newPassword}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    description="至少 8 个字符。"
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                  />
                  <TextField
                    label="确认新密码"
                    type="password"
                    value={confirmPassword}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                  />
                  <div className={page.actions}>
                    <Button type="submit" disabled={securityBusy}>
                      {passwordSaving ? '正在更新' : '更新密码'}
                    </Button>
                  </div>
                </form>

                <section className={styles.sessionSection} aria-labelledby="session-heading">
                  <div className={styles.subsectionTitle}>
                    <h3 id="session-heading">登录设备</h3>
                    {!sessionsLoading && <span>{sessions.length}</span>}
                  </div>
                  {sessionsLoading ? (
                    <p className={page.muted}>正在读取登录设备……</p>
                  ) : (
                    <ul className={styles.sessionList}>
                      {sessions.map((session) => (
                        <li className={styles.sessionItem} key={session.id}>
                          <span className={styles.sessionIcon} aria-hidden="true">
                            <Icon icon={sessionIcons[session.deviceType]} />
                          </span>
                          <span className={styles.sessionCopy}>
                            <span className={styles.sessionName}>
                              <strong>{session.deviceName}</strong>
                              {session.current && <span>当前设备</span>}
                            </span>
                            <span>
                              {session.browserName} · {session.network}
                            </span>
                            <small>
                              最近活动{' '}
                              <time dateTime={session.lastSeenAt}>
                                {formatSessionTime(session.lastSeenAt)}
                              </time>
                            </small>
                          </span>
                          {!session.current && (
                            <Button
                              type="button"
                              variant="quiet"
                              size="small"
                              disabled={securityBusy}
                              aria-label={`退出 ${session.deviceName}`}
                              onClick={() => revokeSession(session.id)}
                            >
                              退出
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </section>
          </Panel>
        </div>
      )}
    </div>
  );
}
