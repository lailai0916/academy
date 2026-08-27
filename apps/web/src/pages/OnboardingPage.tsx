import { useState, type FormEvent } from 'react';
import { Button, Panel, SelectField, TextField } from '@lailai/ui';
import type { ContentKind, Grade, Profile } from '@lailai/academy-shared';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from '../components/Icon';
import { PublicHeader } from '../components/PublicHeader';
import { ApiRequestError, api, errorMessage } from '../lib/api';
import styles from './OnboardingPage.module.css';

const workloads = [
  { value: 10, label: '10 项' },
  { value: 20, label: '20 项' },
  { value: 30, label: '30 项' },
  { value: 40, label: '40 项' },
] as const;

const destinations: {
  value: 'learn' | ContentKind;
  label: string;
  detail: string;
  icon: string;
}[] = [
  { value: 'learn', label: '学习中心', detail: '先查看教材与计划', icon: 'lucide:book-open' },
  { value: 'word', label: '词汇诊断', detail: '抽取 10 项教材词汇', icon: 'lucide:languages' },
  { value: 'poem', label: '古诗词诊断', detail: '抽取 10 项教材内容', icon: 'lucide:feather' },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [grade, setGrade] = useState<Grade>(user?.grade ?? '高一');
  const [targetScore, setTargetScore] = useState(600);
  const [dailyGoal, setDailyGoal] = useState(20);
  const [destination, setDestination] = useState<'learn' | ContentKind>('learn');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api<{ profile: Profile }>('/profile/onboarding', {
        method: 'POST',
        body: JSON.stringify({ displayName, grade, targetScore, dailyGoal }),
      });
      let sessionId = '';
      if (destination !== 'learn') {
        try {
          const session = await api<{ sessionId: string }>('/learn/sessions', {
            method: 'POST',
            body: JSON.stringify({ kind: destination, mode: 'diagnostic', limit: 10 }),
          });
          sessionId = session.sessionId;
        } catch (nextError) {
          if (!(nextError instanceof ApiRequestError && nextError.status === 409)) {
            throw nextError;
          }
        }
      }
      window.location.replace(sessionId ? `/learn/session/${sessionId}` : '/learn');
    } catch (nextError) {
      setError(errorMessage(nextError));
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <PublicHeader minimal />
      <main id="main-content" className={styles.content}>
        <header className={styles.heading}>
          <h1>学习档案</h1>
        </header>

        <Panel feature className={styles.panel}>
          <form className={styles.form} onSubmit={submit}>
            <section className={styles.section} aria-labelledby="identity-heading">
              <h2 id="identity-heading">基本信息</h2>
              <div className={styles.formGrid}>
                <TextField
                  label="显示名称"
                  value={displayName}
                  maxLength={24}
                  autoComplete="nickname"
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
                <SelectField
                  label="当前年级"
                  value={grade}
                  onChange={(event) => setGrade(event.target.value as Grade)}
                >
                  <option value="高一">高一</option>
                  <option value="高二">高二</option>
                  <option value="高三">高三</option>
                </SelectField>
              </div>
              <TextField
                label="高考总分目标"
                type="number"
                min={0}
                max={750}
                value={targetScore}
                onChange={(event) => setTargetScore(Number(event.target.value))}
                required
              />
            </section>

            <fieldset className={styles.section}>
              <legend>每日学习负荷</legend>
              <div className={styles.choiceGrid}>
                {workloads.map((workload) => (
                  <label key={workload.value} className={styles.choice}>
                    <input
                      type="radio"
                      name="daily-goal"
                      value={workload.value}
                      checked={dailyGoal === workload.value}
                      onChange={() => setDailyGoal(workload.value)}
                    />
                    <span>
                      <strong>{workload.label}</strong>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.section}>
              <legend>保存后前往</legend>
              <div className={styles.destinationGrid}>
                {destinations.map((item) => (
                  <label key={item.value} className={styles.destination}>
                    <input
                      type="radio"
                      name="destination"
                      value={item.value}
                      checked={destination === item.value}
                      onChange={() => setDestination(item.value)}
                    />
                    <span className={styles.destinationIcon} aria-hidden="true">
                      <Icon icon={item.icon} />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <footer className={styles.footer}>
              <span>之后可在设置中修改。</span>
              <Button type="submit" size="large" disabled={submitting || !displayName.trim()}>
                {submitting ? '正在保存' : '保存并继续'}
                <Icon icon="lucide:arrow-right" />
              </Button>
            </footer>
          </form>
        </Panel>
      </main>
    </div>
  );
}
