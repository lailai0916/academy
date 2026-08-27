import { useEffect, useState } from 'react';
import { Button, EmptyState, Panel, Progress } from '@lailai/ui';
import { useNavigate } from 'react-router';
import type { ContentKind, Dashboard, LearningOverview } from '@lailai/academy-shared';
import { ActiveSessionCard } from '../components/ActiveSessionCard';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './LearnPage.module.css';

const subjects = {
  word: {
    curriculum: '英语 · 人教版',
    title: '英语词汇',
    description: '从释义识别到拼写和语境应用，题型随掌握度逐步升级。',
    icon: 'lucide:languages',
  },
  poem: {
    curriculum: '语文 · 部编版',
    title: '古诗词',
    description: '通过补空、接句和延迟默写，建立可用于考试的准确回忆。',
    icon: 'lucide:feather',
  },
} as const;

type SessionOptions = {
  focus?: 'all' | 'mistakes';
  unit?: string;
  limit?: number;
};

export function LearnPage({ kind }: { kind?: ContentKind }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [overview, setOverview] = useState<LearningOverview | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const requests: Promise<unknown>[] = [
      api<{ dashboard: Dashboard }>('/dashboard').then((result) => setDashboard(result.dashboard)),
    ];
    if (kind) {
      requests.push(
        api<{ overview: LearningOverview }>(`/learn/overview/${kind}`).then((result) =>
          setOverview(result.overview)
        )
      );
    }
    Promise.all(requests).catch((nextError) => setError(errorMessage(nextError)));
  }, [kind]);

  const start = async (
    targetKind: ContentKind,
    mode: 'plan' | 'review' | 'diagnostic',
    options: SessionOptions = {}
  ) => {
    if (starting) return;
    if (dashboard?.activeSession) {
      navigate(`/learn/session/${dashboard.activeSession.id}`);
      return;
    }
    setStarting(true);
    setError('');
    try {
      const result = await api<{ sessionId: string }>('/learn/sessions', {
        method: 'POST',
        body: JSON.stringify({ kind: targetKind, mode, ...options }),
      });
      navigate(`/learn/session/${result.sessionId}`);
    } catch (nextError) {
      setError(errorMessage(nextError));
      setStarting(false);
    }
  };

  const activeSession = dashboard?.activeSession;

  if (kind) {
    const subject = subjects[kind];
    const summary = overview?.summary;
    return (
      <div className={page.page}>
        <header className={page.pageHeader}>
          <h1 className={page.pageHeading}>{subject.title}</h1>
          <Button size="large" onClick={() => start(kind, 'plan')} disabled={starting}>
            <Icon icon="lucide:play" />
            {activeSession ? '继续当前任务' : '开始今日计划'}
          </Button>
        </header>

        {error && <p className={page.error}>{error}</p>}

        {activeSession && (
          <ActiveSessionCard
            session={activeSession}
            onResume={() => navigate(`/learn/session/${activeSession.id}`)}
          />
        )}

        <div className={page.grid4}>
          <article className={page.metric}>
            <span>综合掌握度</span>
            <strong>{summary ? `${summary.mastery}%` : '—'}</strong>
            <small>{summary?.total ?? '—'} 项教材内容</small>
          </article>
          <article className={page.metric}>
            <span>当前到期</span>
            <strong>{summary?.due ?? '—'}</strong>
            <small>优先恢复即将遗忘的内容</small>
          </article>
          <article className={page.metric}>
            <span>长期掌握</span>
            <strong>{summary?.mastered ?? '—'}</strong>
            <small>稳定期至少 21 天</small>
          </article>
          <article className={page.metric}>
            <span>错题记录</span>
            <strong>{summary?.mistakes ?? '—'}</strong>
            <small>按掌握度优先巩固</small>
          </article>
        </div>

        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>学习方式</h2>
          </div>
          <div className={page.grid3}>
            <Panel>
              <div className={page.panelBody}>
                <span className={page.iconChip}>
                  <Icon icon="lucide:list-checks" />
                </span>
                <div className={page.panelTitleCopy}>
                  <h3>今日计划</h3>
                  <p>先处理到期内容，再按容量补充新内容。</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(kind, 'plan')}
                  disabled={starting || Boolean(activeSession)}
                >
                  开始
                </Button>
              </div>
            </Panel>
            <Panel>
              <div className={page.panelBody}>
                <span className={page.iconChip}>
                  <Icon icon="lucide:rotate-ccw" />
                </span>
                <div className={page.panelTitleCopy}>
                  <h3>错题巩固</h3>
                  <p>从历史错误中挑选尚未稳定掌握的内容。</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(kind, 'review', { focus: 'mistakes' })}
                  disabled={starting || Boolean(activeSession) || summary?.mistakes === 0}
                >
                  开始
                </Button>
              </div>
            </Panel>
            <Panel>
              <div className={page.panelBody}>
                <span className={page.iconChip}>
                  <Icon icon="lucide:scan-search" />
                </span>
                <div className={page.panelTitleCopy}>
                  <h3>水平诊断</h3>
                  <p>随机抽取教材内容，重新估计当前基础。</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(kind, 'diagnostic')}
                  disabled={starting || Boolean(activeSession)}
                >
                  开始
                </Button>
              </div>
            </Panel>
          </div>
        </section>

        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>教材进度</h2>
            <p>{overview ? `${overview.units.length} 个单元` : '正在读取'}</p>
          </div>
          <Panel>
            <div className={styles.unitList}>
              {overview?.units.map((unit) => {
                const progress =
                  unit.total === 0 ? 0 : Math.round((unit.started / unit.total) * 100);
                return (
                  <article key={`${unit.textbook}-${unit.unit}`} className={styles.unitRow}>
                    <div className={styles.unitCopy}>
                      <span>{unit.textbook}</span>
                      <strong>{unit.unit}</strong>
                      <small>
                        已学 {unit.started}/{unit.total} · {unit.due} 项到期 · {unit.mastered}{' '}
                        项长期掌握
                      </small>
                    </div>
                    <div className={styles.unitProgress}>
                      <Progress label={`教材覆盖 ${progress}%`} value={progress} />
                      <Button
                        size="small"
                        variant="quiet"
                        onClick={() => start(kind, 'plan', { unit: unit.unit, limit: 10 })}
                        disabled={starting || Boolean(activeSession)}
                      >
                        学习本单元
                        <Icon icon="lucide:arrow-right" />
                      </Button>
                    </div>
                  </article>
                );
              })}
              {overview && overview.units.length === 0 && (
                <EmptyState
                  title="暂无教材内容"
                  description="管理员发布对应年级的内容后，这里会按教材单元显示。"
                  icon={<Icon icon="lucide:book-open" />}
                />
              )}
            </div>
          </Panel>
        </section>

        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>最近错题</h2>
            <Button variant="quiet" size="small" onClick={() => navigate('/learn/mistakes')}>
              查看错题本
              <Icon icon="lucide:arrow-right" />
            </Button>
          </div>
          <Panel>
            {overview && overview.mistakes.length > 0 ? (
              <ul className={`${page.list} ${styles.mistakeList}`}>
                {overview.mistakes.slice(0, 5).map((mistake) => (
                  <li key={mistake.contentId} className={page.listItem}>
                    <span className={page.iconChip}>
                      <Icon icon={kind === 'word' ? 'lucide:languages' : 'lucide:feather'} />
                    </span>
                    <span className={page.listCopy}>
                      <strong>{mistake.title}</strong>
                      <span>
                        {mistake.detail} · {mistake.unit}
                      </span>
                    </span>
                    <span className={styles.mastery}>{mistake.mastery}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="还没有错题"
                description="答错或查看答案后，相关内容会自动进入这里。"
                icon={<Icon icon="lucide:notebook-tabs" />}
              />
            )}
          </Panel>
        </section>
      </div>
    );
  }

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <h1 className={page.pageHeading}>学习中心</h1>
      </header>

      {error && <p className={page.error}>{error}</p>}

      {activeSession && (
        <ActiveSessionCard
          session={activeSession}
          onResume={() => navigate(`/learn/session/${activeSession.id}`)}
        />
      )}

      <div className={styles.subjectGrid}>
        {(Object.keys(subjects) as ContentKind[]).map((subjectKind) => {
          const subject = subjects[subjectKind];
          const isActiveSubject = activeSession?.kind === subjectKind;
          const due = subjectKind === 'word' ? dashboard?.plan.wordsDue : dashboard?.plan.poemsDue;
          const fresh =
            subjectKind === 'word' ? dashboard?.plan.wordsNew : dashboard?.plan.poemsNew;
          return (
            <Panel key={subjectKind} feature className={styles.subject}>
              <div className={styles.subjectBody}>
                <span className={styles.subjectIcon}>
                  <Icon icon={subject.icon} />
                </span>
                <div className={styles.subjectCopy}>
                  <div className={styles.subjectHeading}>
                    <h2>{subject.title}</h2>
                    <span>{subject.curriculum}</span>
                  </div>
                  <p>{subject.description}</p>
                </div>
                <div className={styles.subjectStats}>
                  <span>
                    <strong>{due ?? '—'}</strong> 到期复习
                  </span>
                  <span>
                    <strong>{fresh ?? '—'}</strong> 今日新学
                  </span>
                </div>
                <div className={page.actions}>
                  <Button
                    onClick={() => start(subjectKind, 'plan')}
                    disabled={starting || Boolean(activeSession && !isActiveSubject)}
                  >
                    {isActiveSubject ? '继续学习' : '开始计划'}
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => navigate(`/learn/${subjectKind === 'word' ? 'words' : 'poems'}`)}
                  >
                    查看详情
                    <Icon icon="lucide:arrow-right" />
                  </Button>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <div className={styles.quickLinks}>
        <button type="button" onClick={() => navigate('/learn/mistakes')}>
          <Icon icon="lucide:notebook-tabs" />
          <span>
            <strong>错题本</strong>
            <small>集中巩固历史错误</small>
          </span>
          <Icon icon="lucide:chevron-right" />
        </button>
        <button type="button" onClick={() => navigate('/progress')}>
          <Icon icon="lucide:chart-no-axes-combined" />
          <span>
            <strong>学习分析</strong>
            <small>查看准确率和薄弱单元</small>
          </span>
          <Icon icon="lucide:chevron-right" />
        </button>
      </div>
    </div>
  );
}
