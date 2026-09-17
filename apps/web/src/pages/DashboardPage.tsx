import { useCallback, useEffect, useState } from 'react';
import { Button, EmptyState, Panel } from '@lailai0916/ui';
import { useNavigate } from 'react-router';
import {
  type Dashboard,
  type LearningInsights,
  type LearningOverview,
  type PlanTask,
} from '@lailai/academy-shared';
import { ActiveSessionCard } from '../components/ActiveSessionCard';
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

const subjectLabels = {
  chinese: '语文',
  mathematics: '数学',
  english: '英语',
  physics: '物理',
  chemistry: '化学',
  technology: '技术',
} as const;

const taskStatusLabels: Record<PlanTask['status'], string> = {
  planned: '待完成',
  active: '进行中',
  completed: '已完成',
};

function taskTotal(task: PlanTask) {
  if (task.kind === 'memory-review') return task.due + task.newCount;
  return Math.max(1, task.totalSteps);
}

function taskCompleted(task: PlanTask) {
  if (task.status === 'completed') return taskTotal(task);
  if (task.kind === 'memory-review') return task.completed;
  return task.completedSteps;
}

function taskMeta(task: PlanTask) {
  if (task.kind === 'memory-review') {
    return `${task.completed} / ${taskTotal(task)} 项 · ${task.due} 项到期 · ${task.newCount} 项新学`;
  }
  if (task.kind === 'assessment') {
    return task.completedSteps > 0
      ? `${task.completedSteps} / ${task.totalSteps} 题 · ${task.reason}`
      : task.reason;
  }
  return `${task.completedSteps} / ${task.totalSteps} 步 · ${task.reason}`;
}

function taskEyebrow(task: PlanTask) {
  if (task.kind === 'memory-review') return '记忆训练';
  return `${task.kind === 'assessment' ? '延迟复测' : '学科课程'} · ${subjectLabels[task.subject]}`;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [startingTask, setStartingTask] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [dashboard, insights, words, poems] = await Promise.all([
        api<{ dashboard: Dashboard }>('/dashboard'),
        api<{ insights: LearningInsights }>('/learn/insights?days=14'),
        api<{ overview: LearningOverview }>('/learn/overview/word'),
        api<{ overview: LearningOverview }>('/learn/overview/poem'),
      ]);
      setData({
        dashboard: dashboard.dashboard,
        insights: insights.insights,
        words: words.overview,
        poems: poems.overview,
      });
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <div className={styles.loadingState} role={error ? 'alert' : 'status'}>
        <span className={styles.loadingIcon} aria-hidden="true">
          <Icon icon={error ? 'lucide:cloud-alert' : 'lucide:calendar-sync'} />
        </span>
        <strong>{error ? '暂时无法读取学习计划' : '正在生成今天的学习计划'}</strong>
        <p>{error || '系统正在合并课程、复测和记忆任务。'}</p>
        {error && (
          <Button variant="secondary" onClick={() => void load()}>
            重新加载
          </Button>
        )}
      </div>
    );
  }

  const { plan, metrics } = data.dashboard;
  const activeSession = data.dashboard.activeSession;
  const totalWork = plan.tasks.reduce((sum, task) => sum + taskTotal(task), 0);
  const completedWork = plan.tasks.reduce((sum, task) => sum + taskCompleted(task), 0);
  const completion = totalWork === 0 ? 0 : Math.round((completedWork / totalWork) * 100);
  const boundedCompletion = Math.min(100, Math.max(0, completion));
  const ringLength = 276.46;
  const ringOffset = ringLength * (1 - boundedCompletion / 100);
  const remainingTasks = plan.tasks.filter((task) => task.status !== 'completed');
  const completedTasks = plan.tasks.length - remainingTasks.length;
  const nextTask =
    plan.tasks.find((task) => task.status === 'active') ??
    plan.tasks.find((task) => task.status === 'planned');
  const planSummary = nextTask
    ? `下一项：${nextTask.title}。${nextTask.kind === 'memory-review' ? plan.reason : nextTask.reason}`
    : plan.tasks.length > 0
      ? '今天的计划已经全部完成。'
      : '当前没有到期或可开始的学习任务。';
  const mistakeCount = data.words.summary.mistakes + data.poems.summary.mistakes;
  const maxDaily = Math.max(1, ...data.insights.daily.map((day) => day.reviews));
  const hasReviewActivity = data.insights.daily.some((day) => day.reviews > 0);
  const forecastTotal = data.insights.forecast.reduce((sum, day) => sum + day.total, 0);
  const openTask = async (task: PlanTask) => {
    if (startingTask) return;
    if (task.status === 'completed') {
      navigate(task.kind === 'memory-review' ? `/learn/${task.contentKind}s` : '/courses');
      return;
    }
    setStartingTask(task.id);
    setError('');
    try {
      if (task.kind === 'memory-review') {
        const response = await api<{ sessionId: string }>('/learn/sessions', {
          method: 'POST',
          body: JSON.stringify({ kind: task.contentKind, mode: 'plan', focus: 'all' }),
        });
        navigate(`/learn/session/${response.sessionId}`);
        return;
      }
      const response = await api<{ runId: string }>(`/courses/${task.courseSlug}/start`, {
        method: 'POST',
      });
      navigate(`/courses/${task.courseSlug}/run/${response.runId}`);
    } catch (nextError) {
      setError(errorMessage(nextError));
      setStartingTask('');
    }
  };

  const runPrimaryAction = () => {
    if (activeSession && activeSession.mode !== 'plan') {
      navigate(`/learn/session/${activeSession.id}`);
      return;
    }
    if (nextTask) {
      void openTask(nextTask);
      return;
    }
    navigate('/courses');
  };

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageHeadingGroup}>
          <h1 className={page.pageHeading}>今日学习</h1>
          <p className={page.pageDescription}>课程、复测和记忆任务按优先级排在同一份计划里。</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={Boolean(startingTask)}
          onClick={runPrimaryAction}
        >
          <Icon icon={nextTask || activeSession ? 'lucide:play' : 'lucide:book-open'} />
          {startingTask
            ? '正在准备'
            : activeSession && activeSession.mode !== 'plan'
              ? '继续当前任务'
              : nextTask?.status === 'active'
                ? '继续下一项'
                : nextTask
                  ? '开始下一项'
                  : '查看学科课程'}
        </Button>
      </header>

      {error && (
        <p className={page.error} role="alert">
          {error}
        </p>
      )}

      {activeSession && activeSession.mode !== 'plan' && (
        <ActiveSessionCard
          session={activeSession}
          onResume={() => navigate(`/learn/session/${activeSession.id}`)}
        />
      )}

      <div className={styles.workspaceGrid}>
        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>今日计划</h2>
            <p>
              {completedTasks} / {plan.tasks.length} 项任务
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
                    {plan.tasks.length === 0
                      ? '今天暂无学习任务'
                      : remainingTasks.length === 0
                        ? '今日计划已完成'
                        : `还需完成 ${remainingTasks.length} 项任务`}
                  </strong>
                  <span>{planSummary}</span>
                </div>
              </div>
              <div className={styles.planItems}>
                {plan.tasks.length === 0 ? (
                  <EmptyState
                    title="今天没有待办任务"
                    description="可以浏览学科课程，或查看学习分析。"
                    icon={<Icon icon="lucide:circle-check-big" />}
                  />
                ) : (
                  plan.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      data-status={task.status}
                      disabled={Boolean(startingTask)}
                      aria-label={`${taskStatusLabels[task.status]}：${task.title}`}
                      onClick={() => void openTask(task)}
                    >
                      <span className={styles.planTaskIcon} data-kind={task.kind}>
                        <Icon
                          icon={
                            task.kind === 'course'
                              ? 'lucide:book-open-check'
                              : task.kind === 'assessment'
                                ? 'lucide:clipboard-check'
                                : task.contentKind === 'word'
                                  ? 'lucide:languages'
                                  : 'lucide:feather'
                          }
                        />
                      </span>
                      <span className={styles.planTaskCopy}>
                        <span className={styles.planTaskEyebrow}>
                          <span>{taskEyebrow(task)}</span>
                          <span className={styles.planTaskStatus} data-status={task.status}>
                            {taskStatusLabels[task.status]}
                          </span>
                        </span>
                        <strong>{task.title}</strong>
                        <small>{taskMeta(task)}</small>
                      </span>
                      <span className={styles.planTaskAction} aria-hidden="true">
                        <Icon
                          icon={
                            task.status === 'completed'
                              ? 'lucide:check'
                              : task.status === 'active'
                                ? 'lucide:play'
                                : 'lucide:chevron-right'
                          }
                        />
                      </span>
                    </button>
                  ))
                )}
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
              <article>
                <span>
                  <Icon icon="lucide:calendar-clock" />
                </span>
                <div>
                  <strong>{forecastTotal}</strong>
                  <small>项 7 日预计复习</small>
                </div>
              </article>
              <div className={styles.focusActions}>
                <Button variant="secondary" size="sm" onClick={() => navigate('/learn/mistakes')}>
                  打开错题本
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/progress')}>
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
