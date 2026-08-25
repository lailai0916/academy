import { useEffect, useState } from 'react';
import { Button, EmptyState, Panel } from '@lailai/ui';
import { useNavigate } from 'react-router';
import type { Dashboard, LearningInsights, LearningOverview } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './DashboardPage.module.css';

type DashboardData = {
  dashboard: Dashboard;
  insights: LearningInsights;
  words: LearningOverview;
  poems: LearningOverview;
};

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<{ dashboard: Dashboard }>('/dashboard'),
      api<{ insights: LearningInsights }>('/learn/insights?days=14'),
      api<{ overview: LearningOverview }>('/learn/overview/word'),
      api<{ overview: LearningOverview }>('/learn/overview/poem'),
    ])
      .then(([dashboard, insights, words, poems]) =>
        setData({
          dashboard: dashboard.dashboard,
          insights: insights.insights,
          words: words.overview,
          poems: poems.overview,
        })
      )
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

  if (error) return <p className={page.error}>{error}</p>;
  if (!data) return <div className={page.empty}>正在生成今天的学习计划……</div>;

  const { plan, metrics, user } = data.dashboard;
  const completion = plan.total === 0 ? 0 : Math.round((plan.completed / plan.total) * 100);
  const boundedCompletion = Math.min(100, Math.max(0, completion));
  const ringLength = 276.46;
  const ringOffset = ringLength * (1 - boundedCompletion / 100);
  const remaining = Math.max(0, plan.total - plan.completed);
  const mistakeCount = data.words.summary.mistakes + data.poems.summary.mistakes;
  const maxDaily = Math.max(1, ...data.insights.daily.map((day) => day.reviews));
  const hasReviewActivity = data.insights.daily.some((day) => day.reviews > 0);

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>
            {plan.date} · {user.grade}
          </p>
          <h1>今日学习</h1>
          <p>{plan.reason}</p>
        </div>
        <Button size="large" onClick={() => navigate('/learn')}>
          <Icon icon="lucide:play" />
          开始学习
        </Button>
      </header>

      <div className={styles.workspaceGrid}>
        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>今日计划</h2>
            <p>
              {plan.completed} / {plan.total} 项
            </p>
          </div>
          <Panel feature className={styles.planPanel}>
            <div className={styles.plan}>
              <div className={styles.planProgress}>
                <div
                  className={styles.progressRing}
                  role="progressbar"
                  aria-label="今日计划完成度"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={boundedCompletion}
                >
                  <svg viewBox="0 0 104 104" aria-hidden="true">
                    <circle className={styles.ringTrack} cx="52" cy="52" r="44" />
                    <circle
                      className={styles.ringValue}
                      cx="52"
                      cy="52"
                      r="44"
                      style={{ strokeDashoffset: ringOffset }}
                    />
                  </svg>
                  <span>
                    <strong>{boundedCompletion}%</strong>
                    <small>完成</small>
                  </span>
                </div>
                <div className={styles.progressCopy}>
                  <strong>
                    {plan.total === 0
                      ? '今天暂无计划'
                      : remaining === 0
                        ? '今日计划已完成'
                        : `还需完成 ${remaining} 项`}
                  </strong>
                  <span>到期内容优先，其后安排新学内容</span>
                </div>
              </div>
              <div className={styles.planItems}>
                <button type="button" onClick={() => navigate('/learn/words')}>
                  <span className={page.iconChip}>
                    <Icon icon="lucide:languages" />
                  </span>
                  <span>
                    <strong>英语单词</strong>
                    <small>
                      {plan.wordsDue} 项复习 · {plan.wordsNew} 项新学
                    </small>
                  </span>
                  <Icon icon="lucide:chevron-right" />
                </button>
                <button type="button" onClick={() => navigate('/learn/poems')}>
                  <span className={page.iconChip}>
                    <Icon icon="lucide:feather" />
                  </span>
                  <span>
                    <strong>古诗词</strong>
                    <small>
                      {plan.poemsDue} 项复习 · {plan.poemsNew} 项新学
                    </small>
                  </span>
                  <Icon icon="lucide:chevron-right" />
                </button>
              </div>
            </div>
          </Panel>
        </section>

        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>当前重点</h2>
          </div>
          <Panel className={styles.focusPanel}>
            <div className={styles.focus}>
              <article>
                <span>
                  <Icon icon="lucide:rotate-ccw" />
                </span>
                <div>
                  <strong>{plan.wordsDue + plan.poemsDue}</strong>
                  <small>项到期复习</small>
                </div>
              </article>
              <article>
                <span>
                  <Icon icon="lucide:notebook-tabs" />
                </span>
                <div>
                  <strong>{mistakeCount}</strong>
                  <small>项历史错题</small>
                </div>
              </article>
              <article>
                <span>
                  <Icon icon="lucide:target" />
                </span>
                <div>
                  <strong>{metrics.longTermCards}</strong>
                  <small>项长期记忆</small>
                </div>
              </article>
              <div className={styles.focusActions}>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => navigate('/learn/mistakes')}
                >
                  打开错题本
                </Button>
                <Button variant="quiet" size="small" onClick={() => navigate('/progress')}>
                  查看分析
                </Button>
              </div>
            </div>
          </Panel>
        </section>
      </div>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>学习结果</h2>
          <p>长期记忆指标</p>
        </div>
        <div className={page.grid4}>
          <article className={page.metric}>
            <span>综合掌握度</span>
            <strong>{metrics.mastery}%</strong>
            <small>稳定性与可回忆概率</small>
          </article>
          <article className={page.metric}>
            <span>延迟测试正确率</span>
            <strong>{metrics.delayedAccuracy}%</strong>
            <small>间隔至少 24 小时</small>
          </article>
          <article className={page.metric}>
            <span>长期记忆项目</span>
            <strong>{metrics.longTermCards}</strong>
            <small>稳定期达到 21 天</small>
          </article>
          <article className={page.metric}>
            <span>连续学习</span>
            <strong>{metrics.streakDays}</strong>
            <small>天</small>
          </article>
        </div>
      </section>

      <div className={styles.lowerGrid}>
        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>近 14 天</h2>
            <Button variant="quiet" size="small" onClick={() => navigate('/progress')}>
              完整分析
            </Button>
          </div>
          <Panel>
            {hasReviewActivity ? (
              <>
                <div className={styles.miniChart}>
                  {data.insights.daily.map((day) => (
                    <div key={day.date} title={`${day.date} · ${day.reviews} 次`}>
                      <span style={{ height: `${Math.max(3, (day.reviews / maxDaily) * 100)}%` }} />
                    </div>
                  ))}
                </div>
                <div className={styles.chartMeta}>
                  <span>{data.insights.metrics.reviewCount} 次有效复习</span>
                  <span>{data.insights.metrics.activeDays} 个学习日</span>
                  <span>{data.insights.metrics.accuracy}% 正确率</span>
                </div>
              </>
            ) : (
              <EmptyState
                title="近 14 天暂无复习记录"
                description="完成一组学习后，这里会显示每日复习量。"
                icon={<Icon icon="lucide:chart-no-axes-column" />}
              />
            )}
          </Panel>
        </section>

        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>最近完成</h2>
          </div>
          <Panel>
            {data.dashboard.recentActivity.length === 0 ? (
              <EmptyState
                title="暂无完成记录"
                description="完成第一组学习后，这里会显示最近结果。"
                icon={<Icon icon="lucide:list-checks" />}
              />
            ) : (
              <ul className={`${page.list} ${styles.activityList}`}>
                {data.dashboard.recentActivity.map((item) => (
                  <li key={item.id} className={page.listItem}>
                    <span className={page.iconChip}>
                      <Icon
                        icon={item.kind.includes('word') ? 'lucide:languages' : 'lucide:feather'}
                      />
                    </span>
                    <span className={page.listCopy}>
                      <strong>{item.summary}</strong>
                      <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}
