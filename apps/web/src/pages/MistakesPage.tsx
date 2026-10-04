import { Alert, Button, DataCard, EmptyState, Panel, Progress, Tabs } from '@lailai0916/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ContentKind, LearningOverview } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './MistakesPage.module.css';

const labels = {
  word: { name: '英语词汇', icon: 'lucide:languages' },
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
        <div className={page.pageHeadingGroup}>
          <h1 className={page.pageHeading}>错题本</h1>
          <p className={page.pageDescription}>按遗忘次数和掌握度集中处理薄弱内容。</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={start}
          disabled={starting || !overview?.mistakes.length}
        >
          <Icon icon="lucide:rotate-ccw" />
          巩固当前错题
        </Button>
      </header>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className={page.grid3}>
        <DataCard
          label={'错题内容'}
          value={data ? totalMistakes : '—'}
          description={'按内容去重'}
          icon="lucide:notebook-tabs"
        />
        <DataCard
          label={'当前科目掌握度'}
          value={overview ? `${overview.summary.mastery}%` : '—'}
          description={labels[kind].name}
          icon="lucide:target"
        />
        <DataCard
          label={'当前到期'}
          value={overview?.summary.due ?? '—'}
          description={'优先进入巩固任务'}
          icon="lucide:calendar-clock"
        />
      </div>

      <Tabs
        size="sm"
        ariaLabel="错题科目"
        value={kind}
        onChange={setKind}
        items={(Object.keys(labels) as ContentKind[]).map((value) => ({
          value,
          label: `${labels[value].name} (${data?.[value].summary.mistakes ?? 0})`,
          icon: labels[value].icon,
          id: `mistakes-tab-${value}`,
          panelId: `mistakes-panel-${value}`,
        }))}
      />

      <Panel role="tabpanel" id={`mistakes-panel-${kind}`} aria-labelledby={`mistakes-tab-${kind}`}>
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
                  <Progress label="掌握度" value={mistake.mastery} />
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
