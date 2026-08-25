import { useEffect, useState } from 'react';
import { Button, Panel, Progress } from '@lailai/ui';
import { useNavigate } from 'react-router';
import type { Dashboard } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './DashboardPage.module.css';

export function DashboardPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ dashboard: Dashboard }>('/dashboard')
      .then((result) => setDashboard(result.dashboard))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

  if (error) {
    return <p className={page.error}>{error}</p>;
  }
  if (!dashboard) {
    return <div className={page.empty}>正在生成今天的学习计划……</div>;
  }

  const { plan, metrics, user } = dashboard;
  const completion = plan.total === 0 ? 0 : Math.round((plan.completed / plan.total) * 100);

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>{plan.date}</p>
          <h1>{user.displayName}，今天继续向目标靠近。</h1>
          <p>{plan.reason}</p>
        </div>
        <Button size="large" onClick={() => navigate('/learn')}>
          <Icon icon="lucide:play" />
          开始今天的学习
        </Button>
      </header>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>今天的计划</h2>
          <p>
            {plan.completed} / {plan.total} 项
          </p>
        </div>
        <Panel feature>
          <div className={styles.plan}>
            <div className={styles.planProgress}>
              <div className={styles.completion}>
                <strong>{completion}%</strong>
                <span>今日完成</span>
              </div>
              <Progress label="学习计划完成度" value={completion} showValue={false} />
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
          <h2>真实学习结果</h2>
          <p>不以使用时长作为核心指标</p>
        </div>
        <div className={page.grid4}>
          <article className={page.metric}>
            <span>综合掌握度</span>
            <strong>{metrics.mastery}%</strong>
            <small>稳定性与当前可回忆概率</small>
          </article>
          <article className={page.metric}>
            <span>延迟测试正确率</span>
            <strong>{metrics.delayedAccuracy}%</strong>
            <small>间隔至少 24 小时后的表现</small>
          </article>
          <article className={page.metric}>
            <span>长期记忆项目</span>
            <strong>{metrics.longTermCards}</strong>
            <small>稳定期达到 21 天</small>
          </article>
          <article className={page.metric}>
            <span>连续有效学习</span>
            <strong>{metrics.streakDays}</strong>
            <small>天</small>
          </article>
        </div>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>最近完成</h2>
        </div>
        <Panel>
          <div className={page.panelBody}>
            {dashboard.recentActivity.length === 0 ? (
              <p className={page.muted}>完成第一组练习后，结果会出现在这里。</p>
            ) : (
              <ul className={page.list}>
                {dashboard.recentActivity.map((item) => (
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
          </div>
        </Panel>
      </section>
    </div>
  );
}
