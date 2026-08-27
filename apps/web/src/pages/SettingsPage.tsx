import { useEffect, useState, type FormEvent } from 'react';
import { Button, Panel, SelectField, TextAreaField, TextField } from '@lailai/ui';
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
        <h1 className={page.pageHeading}>设置</h1>
      </header>
      {error && <p className={page.error}>{error}</p>}
      {message && <p className={page.success}>{message}</p>}
      {profile && (
        <Panel feature>
          <form className={styles.adminSection} onSubmit={submit}>
            <div className={page.panelTitle}>
              <div className={page.panelTitleCopy}>
                <h2>个人资料与学习目标</h2>
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
      )}
    </div>
  );
}
