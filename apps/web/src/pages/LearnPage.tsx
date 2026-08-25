import { useEffect, useState } from 'react';
import { Button, Panel } from '@lailai/ui';
import { useNavigate } from 'react-router';
import type { ContentKind, Dashboard } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './LearnPage.module.css';

const subjects = {
  word: {
    eyebrow: '英语 · 人教版',
    title: 'AI 背单词',
    description: '从释义识别到拼写和语境应用，题型随掌握度逐步升级。',
    icon: 'lucide:languages',
  },
  poem: {
    eyebrow: '语文 · 部编版',
    title: 'AI 背古诗词',
    description: '通过补空、接句和延迟默写，建立可用于考试的准确回忆。',
    icon: 'lucide:feather',
  },
} as const;

export function LearnPage({ kind }: { kind?: ContentKind }) {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ dashboard: Dashboard }>('/dashboard')
      .then((result) => setDashboard(result.dashboard))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

  const start = async (targetKind: ContentKind, mode: 'plan' | 'review' | 'diagnostic') => {
    if (starting) {
      return;
    }
    setStarting(`${targetKind}-${mode}`);
    setError('');
    try {
      const result = await api<{ sessionId: string }>('/learn/sessions', {
        method: 'POST',
        body: JSON.stringify({ kind: targetKind, mode }),
      });
      navigate(`/learn/session/${result.sessionId}`);
    } catch (nextError) {
      setError(errorMessage(nextError));
      setStarting(null);
    }
  };

  if (kind) {
    const subject = subjects[kind];
    const due = kind === 'word' ? dashboard?.plan.wordsDue : dashboard?.plan.poemsDue;
    const fresh = kind === 'word' ? dashboard?.plan.wordsNew : dashboard?.plan.poemsNew;
    return (
      <div className={page.page}>
        <header className={page.pageHeader}>
          <div className={page.pageTitle}>
            <p className={page.eyebrow}>{subject.eyebrow}</p>
            <h1>{subject.title}</h1>
            <p>{subject.description}</p>
          </div>
          <Button size="large" onClick={() => start(kind, 'plan')} disabled={Boolean(starting)}>
            <Icon icon="lucide:play" />
            开始计划
          </Button>
        </header>

        {error && <p className={page.error}>{error}</p>}

        <div className={page.grid3}>
          <article className={page.metric}>
            <span>当前到期复习</span>
            <strong>{due ?? '—'}</strong>
            <small>FSRS 按遗忘概率安排</small>
          </article>
          <article className={page.metric}>
            <span>今天新学</span>
            <strong>{fresh ?? '—'}</strong>
            <small>避免新内容挤占到期复习</small>
          </article>
          <article className={page.metric}>
            <span>目标留存率</span>
            <strong>90%</strong>
            <small>调度器目标，不等同于即时正确率</small>
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
                  <h3>按今日计划</h3>
                  <p>先复习到期内容，再补充适量新内容。</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(kind, 'plan')}
                  disabled={Boolean(starting)}
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
                  <h3>只复习</h3>
                  <p>仅处理已经到期的内容，不引入新项目。</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(kind, 'review')}
                  disabled={Boolean(starting)}
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
                  <p>抽取内容建立初始难度和掌握度记录。</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => start(kind, 'diagnostic')}
                  disabled={Boolean(starting)}
                >
                  开始
                </Button>
              </div>
            </Panel>
          </div>
        </section>

        <Panel tone="muted">
          <div className={styles.method}>
            <Icon icon="lucide:info" />
            <div>
              <strong>为什么每个人看到的题目不同？</strong>
              <p>
                系统会结合复习间隔、历史错误、反应时间和当前稳定性调整题型。即时答对不代表长期掌握，至少间隔
                24 小时后的正确率更重要。
              </p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>学习中心</p>
          <h1>选择今天要攻克的内容。</h1>
          <p>首期聚焦英语单词和古诗词，所有结果进入同一套掌握度与长期记忆模型。</p>
        </div>
      </header>

      {error && <p className={page.error}>{error}</p>}

      <div className={styles.subjectGrid}>
        {(Object.keys(subjects) as ContentKind[]).map((subjectKind) => {
          const subject = subjects[subjectKind];
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
                  <p>{subject.eyebrow}</p>
                  <h2>{subject.title}</h2>
                  <span>{subject.description}</span>
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
                  <Button onClick={() => start(subjectKind, 'plan')} disabled={Boolean(starting)}>
                    开始计划
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

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>后续课程框架</h2>
          <p>按教材学科与单元扩展</p>
        </div>
        <div className={page.grid3}>
          {[
            ['lucide:sigma', '数学', '知识点诊断、例题理解与变式训练'],
            ['lucide:atom', '物理', '概念模型、实验与分层计算'],
            ['lucide:flask-conical', '化学', '方程式、实验现象与推断'],
          ].map(([icon, title, description]) => (
            <Panel key={title} tone="muted">
              <div className={page.panelBody}>
                <span className={page.iconChip}>
                  <Icon icon={icon} />
                </span>
                <div className={page.panelTitleCopy}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <span className={styles.pending}>框架已预留</span>
              </div>
            </Panel>
          ))}
        </div>
      </section>
    </div>
  );
}
