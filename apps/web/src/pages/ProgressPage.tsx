import { useEffect, useState } from 'react';
import { Button, EmptyState, Panel, Progress } from '@lailai/ui';
import { useNavigate } from 'react-router';
import type { LearningInsights } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import { sessionModeLabels, sessionStatusLabels } from '../lib/learning';
import page from './Page.module.css';
import styles from './ProgressPage.module.css';

const weekdayFormat = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  weekday: 'short',
});

export function ProgressPage() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<LearningInsights | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ insights: LearningInsights }>('/learn/insights?days=30')
      .then((result) => setInsights(result.insights))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

  if (error && !insights) return <p className={page.error}>{error}</p>;
  if (!insights) return <div className={page.empty}>正在整理学习记录……</div>;

  const maxReviews = Math.max(1, ...insights.daily.map((day) => day.reviews));
  const hasReviewActivity = insights.daily.some((day) => day.reviews > 0);
  const forecastTotal = insights.forecast.reduce((sum, day) => sum + day.total, 0);
  const maxForecast = Math.max(1, ...insights.forecast.map((day) => day.total));

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <h1 className={page.pageHeading}>学习分析</h1>
      </header>

      <div className={page.grid4}>
        <article className={page.metric}>
          <span>有效复习</span>
          <strong>{insights.metrics.reviewCount}</strong>
          <small>次</small>
        </article>
        <article className={page.metric}>
          <span>整体正确率</span>
          <strong>{insights.metrics.accuracy}%</strong>
          <small>全部作答</small>
        </article>
        <article className={page.metric}>
          <span>延迟测试正确率</span>
          <strong>{insights.metrics.delayedAccuracy}%</strong>
          <small>至少间隔 24 小时</small>
        </article>
        <article className={page.metric}>
          <span>有效学习日</span>
          <strong>{insights.metrics.activeDays}</strong>
          <small>不以在线时长计数</small>
        </article>
      </div>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>未来 7 天</h2>
          <p>预计 {forecastTotal} 项复习</p>
        </div>
        <Panel>
          <ol className={styles.forecastList} aria-label="未来 7 天复习安排">
            {insights.forecast.map((day, index) => (
              <li key={day.date}>
                <span className={styles.forecastDate}>
                  <strong>
                    {index === 0
                      ? '今天'
                      : weekdayFormat.format(new Date(`${day.date}T12:00:00+08:00`))}
                  </strong>
                  <time dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time>
                </span>
                <span
                  className={styles.forecastTrack}
                  role="progressbar"
                  aria-label={`${day.date} 预计复习 ${day.total} 项`}
                  aria-valuemin={0}
                  aria-valuemax={maxForecast}
                  aria-valuenow={day.total}
                >
                  <span style={{ width: `${(day.total / maxForecast) * 100}%` }} />
                </span>
                <span className={styles.forecastKinds}>
                  {day.total === 0 ? (
                    '无安排'
                  ) : (
                    <>
                      <span>词汇 {day.word}</span>
                      <span>古诗词 {day.poem}</span>
                    </>
                  )}
                </span>
                <strong className={styles.forecastCount}>{day.total}</strong>
              </li>
            ))}
          </ol>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>每日复习</h2>
          <p>柱高表示复习量，颜色深浅表示正确率</p>
        </div>
        <Panel>
          {hasReviewActivity ? (
            <div className={styles.chart} role="img" aria-label="近 30 天每日复习数量与正确率">
              <div className={styles.plot}>
                {insights.daily.map((day, index) => (
                  <div
                    key={day.date}
                    className={styles.day}
                    title={`${day.date}：${day.reviews} 次，正确率 ${day.accuracy}%`}
                  >
                    <div
                      className={styles.bar}
                      style={{
                        height: `${Math.max(day.reviews ? 8 : 2, (day.reviews / maxReviews) * 100)}%`,
                        opacity: day.reviews ? Math.max(0.42, day.accuracy / 100) : 0.18,
                      }}
                    />
                    {(index === 0 || index === insights.daily.length - 1 || index % 7 === 0) && (
                      <time dateTime={day.date}>{day.date.slice(5).replace('-', '/')}</time>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.chartSummary}>
                <span>平均反应 {Math.round(insights.metrics.averageResponseMs / 100) / 10} 秒</span>
                <span>只统计完成提交的学习项目</span>
              </div>
            </div>
          ) : (
            <EmptyState
              title="近 30 天暂无复习记录"
              description="完成一组学习后，这里会显示每日复习量和正确率。"
              icon={<Icon icon="lucide:chart-no-axes-column" />}
            />
          )}
        </Panel>
      </section>

      <div className={styles.columns}>
        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>薄弱单元</h2>
          </div>
          <Panel>
            {insights.weakUnits.length > 0 ? (
              <div className={styles.weakList}>
                {insights.weakUnits.map((unit) => (
                  <article key={`${unit.kind}-${unit.unit}`}>
                    <div>
                      <span>{unit.kind === 'word' ? '英语词汇' : '古诗词'}</span>
                      <strong>{unit.unit}</strong>
                      <small>
                        {unit.cardCount} 项已学 · {unit.due} 项到期 · 累计遗忘 {unit.lapses} 次
                      </small>
                    </div>
                    <Progress label={`掌握度 ${unit.mastery}%`} value={unit.mastery} />
                    <Button
                      size="small"
                      variant="quiet"
                      onClick={() =>
                        navigate(unit.kind === 'word' ? '/learn/words' : '/learn/poems')
                      }
                    >
                      查看
                    </Button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="暂无薄弱单元"
                description="完成学习后，系统会按当前掌握度列出需要优先处理的单元。"
                icon={<Icon icon="lucide:chart-no-axes-combined" />}
              />
            )}
          </Panel>
        </section>

        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>最近学习</h2>
          </div>
          <Panel>
            {insights.recentSessions.length > 0 ? (
              <div className={styles.sessionList}>
                {insights.recentSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate(`/learn/session/${session.id}`)}
                  >
                    <span className={styles.sessionIcon}>
                      <Icon
                        icon={session.kind === 'word' ? 'lucide:languages' : 'lucide:feather'}
                      />
                    </span>
                    <span>
                      <strong>{sessionModeLabels[session.mode]}</strong>
                      <small>
                        {session.completedCount}/{session.plannedCount} 项 · 首轮正确率{' '}
                        {session.firstPassAccuracy}%
                        {session.recoveredCount > 0 ? ` · 纠正 ${session.recoveredCount} 项` : ''}
                      </small>
                    </span>
                    <span className={styles.sessionMeta}>
                      <span className={styles.sessionStatus} data-status={session.status}>
                        {sessionStatusLabels[session.status]}
                      </span>
                      <time dateTime={session.startedAt}>
                        {new Date(session.startedAt).toLocaleDateString('zh-CN')}
                      </time>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="还没有学习记录"
                description="完成第一组学习后，这里会保留结果。"
                icon={<Icon icon="lucide:list-checks" />}
              />
            )}
          </Panel>
        </section>
      </div>
    </div>
  );
}
