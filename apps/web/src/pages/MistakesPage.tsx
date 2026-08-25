import { useEffect, useState } from 'react';
import { Button, EmptyState, Panel, Progress } from '@lailai/ui';
import { useNavigate } from 'react-router';
import type { ContentKind, LearningOverview } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './MistakesPage.module.css';

const labels = {
  word: { name: '英语单词', icon: 'lucide:languages' },
  poem: { name: '古诗词', icon: 'lucide:feather' },
} as const;

export function MistakesPage() {
  const navigate = useNavigate();
  const [kind, setKind] = useState<ContentKind>('word');
  const [data, setData] = useState<Record<ContentKind, LearningOverview> | null>(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ overview: LearningOverview }>('/learn/overview/word'),
      api<{ overview: LearningOverview }>('/learn/overview/poem'),
    ])
      .then(([words, poems]) => setData({ word: words.overview, poem: poems.overview }))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      const result = await api<{ sessionId: string }>('/learn/sessions', {
        method: 'POST',
        body: JSON.stringify({ kind, mode: 'review', focus: 'mistakes', limit: 20 }),
      });
      navigate(`/learn/session/${result.sessionId}`);
    } catch (nextError) {
      setError(errorMessage(nextError));
      setStarting(false);
    }
  };

  const overview = data?.[kind];
  const totalMistakes = data ? data.word.summary.mistakes + data.poem.summary.mistakes : 0;

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>学习</p>
          <h1>错题本</h1>
          <p>记录答错和查看答案的内容，并按当前掌握度排序。</p>
        </div>
        <Button size="large" onClick={start} disabled={starting || !overview?.mistakes.length}>
          <Icon icon="lucide:rotate-ccw" />
          巩固当前错题
        </Button>
      </header>

      {error && <p className={page.error}>{error}</p>}

      <div className={page.grid3}>
        <article className={page.metric}>
          <span>错题内容</span>
          <strong>{data ? totalMistakes : '—'}</strong>
          <small>按内容去重</small>
        </article>
        <article className={page.metric}>
          <span>当前科目掌握度</span>
          <strong>{overview ? `${overview.summary.mastery}%` : '—'}</strong>
          <small>{labels[kind].name}</small>
        </article>
        <article className={page.metric}>
          <span>当前到期</span>
          <strong>{overview?.summary.due ?? '—'}</strong>
          <small>优先进入巩固任务</small>
        </article>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="错题科目">
        {(Object.keys(labels) as ContentKind[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className={kind === value ? styles.active : ''}
            onClick={() => setKind(value)}
          >
            <Icon icon={labels[value].icon} />
            {labels[value].name}
            <span>{data?.[value].summary.mistakes ?? 0}</span>
          </button>
        ))}
      </div>

      <Panel>
        {overview && overview.mistakes.length > 0 ? (
          <div className={styles.list}>
            {overview.mistakes.map((mistake) => (
              <article key={mistake.contentId} className={styles.item}>
                <span className={styles.icon}>
                  <Icon icon={labels[kind].icon} />
                </span>
                <div className={styles.copy}>
                  <strong>{mistake.title}</strong>
                  <span>{mistake.detail}</span>
                  <small>
                    {mistake.textbook} · {mistake.unit}
                  </small>
                </div>
                <div className={styles.progress}>
                  <Progress label={`掌握度 ${mistake.mastery}%`} value={mistake.mastery} />
                  <span>
                    错误 {mistake.mistakeCount} 次 · 最近{' '}
                    {new Date(mistake.lastMistakeAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="当前科目没有错题"
            description="完成诊断或学习任务后，错误会自动归入这里。"
            icon={<Icon icon="lucide:check-circle-2" />}
            action={
              <Button
                variant="secondary"
                onClick={() => navigate(kind === 'word' ? '/learn/words' : '/learn/poems')}
              >
                前往学习
              </Button>
            }
          />
        )}
      </Panel>
    </div>
  );
}
