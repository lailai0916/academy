import { useEffect, useState, type FormEvent } from 'react';
import { Button, Panel, SelectField, TextAreaField, TextField, ThemeControl } from '@lailai/ui';
import type { Grade, Profile } from '@lailai/academy-shared';
import { useAuth } from '../auth/AuthProvider';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './FeaturePages.module.css';

export function SettingsPage() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ profile: Profile }>('/profile/me')
      .then((result) => setProfile(result.profile))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

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

  if (!profile && !error) return <div className={page.empty}>正在载入设置……</div>;

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>我的</p>
          <h1>设置</h1>
          <p>修改个人资料、学习目标和外观。</p>
        </div>
      </header>
      {error && <p className={page.error}>{error}</p>}
      {message && <p className={page.success}>{message}</p>}
      {profile && (
        <div className={styles.settingsGrid}>
          <Panel feature>
            <form className={styles.adminSection} onSubmit={submit}>
              <div className={page.panelTitle}>
                <div className={page.panelTitleCopy}>
                  <h2>个人资料与学习目标</h2>
                  <p>年级、目标分数和每日项目数会影响学习计划。</p>
                </div>
              </div>
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
                  description="系统会优先安排到期复习。"
                />
              </div>
              <label className="lui-field">
                <span className="lui-field__label">个人主页可见性</span>
                <select
                  className="lui-field__control"
                  value={profile.isPublic ? 'public' : 'private'}
                  onChange={(event) => update('isPublic', event.target.value === 'public')}
                >
                  <option value="public">平台用户可见</option>
                  <option value="private">仅自己可见</option>
                </select>
              </label>
              <div className={page.actions}>
                <Button type="submit" disabled={saving}>
                  {saving ? '正在保存' : '保存设置'}
                </Button>
              </div>
            </form>
          </Panel>
          <Panel>
            <div className={`${styles.adminSection} ${styles.themeBox}`}>
              <div className={page.panelTitleCopy}>
                <h2>外观</h2>
                <p>当前设备的显示方式。</p>
              </div>
              <ThemeControl labels={{ system: '自动', light: '浅色', dark: '深色' }} />
              <p className={page.muted}>选择保存在当前设备。</p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
