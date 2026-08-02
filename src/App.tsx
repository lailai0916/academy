import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

type IconName = 'arrow' | 'book' | 'brain' | 'calendar' | 'check' | 'feather' | 'refresh' | 'spark';

type Task = {
  id: string;
  title: string;
  detail: string;
  type: 'Words' | 'Poems' | 'Focus';
  done: boolean;
};

type PlanPreview = {
  goal: string;
  steps: string[];
};

const STORAGE_KEY = 'academy.tasks.v0';

const starterTasks: Task[] = [
  {
    id: 'words',
    title: 'Review a small word set',
    detail: 'Words · 12 minutes',
    type: 'Words',
    done: false,
  },
  {
    id: 'poems',
    title: 'Recite a short passage',
    detail: 'Poems · 15 minutes',
    type: 'Poems',
    done: false,
  },
  {
    id: 'focus',
    title: 'One focused study session',
    detail: 'Choose a topic · 25 minutes',
    type: 'Focus',
    done: false,
  },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }): ReactNode {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  const paths: Record<IconName, ReactNode> = {
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z" />
        <path d="M4 5.5v16M8 7h8M8 11h8" />
      </>
    ),
    brain: (
      <>
        <path d="M9.5 4.5a3 3 0 0 0-5.2 2.6A3 3 0 0 0 4 12a3 3 0 0 0 1.7 5.2A3 3 0 0 0 11 19.5V5.8a3 3 0 0 0-1.5-1.3Z" />
        <path d="M14.5 4.5a3 3 0 0 1 5.2 2.6A3 3 0 0 1 20 12a3 3 0 0 1-1.7 5.2 3 3 0 0 1-5.3 2.3V5.8a3 3 0 0 1 1.5-1.3ZM6.5 9h3M14.5 9h3M6.5 14h3M14.5 14h3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2" />
        <path d="M7 3v3M17 3v3M3 9h18" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    feather: (
      <>
        <path d="M20.5 3.5C13 2.8 7.8 6.3 7.2 13.3c-.2 2.2.7 4 2.8 5.2 1.4.8 3.1.2 4.2-1.1C17.4 13.4 18.2 8.7 20.5 3.5Z" />
        <path d="M4 20c3.7-3.6 7.5-6.9 12.4-10.2M5.5 16.5H9M8.2 12.5h3" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-13.8-4.9L4 8.5" />
        <path d="M4 4.5v4h4M4 13a8 8 0 0 0 13.8 4.9l2.2-2.4" />
        <path d="M20 19.5v-4h-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z" />
        <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} {...common}>
      {paths[name]}
    </svg>
  );
}

function formatDate(): string {
  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
}

function loadTasks(): Task[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return starterTasks;
    const parsed = JSON.parse(saved) as Task[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : starterTasks;
  } catch {
    return starterTasks;
  }
}

function App(): ReactNode {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [activeModule, setActiveModule] = useState<'Words' | 'Poems' | 'Review'>('Words');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const completedCount = tasks.filter((task) => task.done).length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const moduleContent = useMemo(
    () => ({
      Words: {
        icon: 'book' as IconName,
        title: 'Words',
        label: '单词记忆',
        description: '用间隔复习把词汇分成今天能完成的小组。',
        action: '添加单词任务',
        meta: '等待你的第一组词',
      },
      Poems: {
        icon: 'feather' as IconName,
        title: 'Poems',
        label: '古诗文',
        description: '按篇章建立线索，从理解开始，再进入背诵。',
        action: '添加一篇古诗',
        meta: '还没有收藏内容',
      },
      Review: {
        icon: 'refresh' as IconName,
        title: 'Review',
        label: '复习队列',
        description: '把遗忘变成下一次提示，让复习回到节奏里。',
        action: '回到今日安排',
        meta: '今天没有待复习项目',
      },
    }),
    [],
  );

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  };

  const createPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextGoal = goal.trim();
    if (!nextGoal) return;

    setPlan({
      goal: nextGoal,
      steps: ['拆成一个 25 分钟专注单元', '安排一次主动回忆', '在今天结束前留下下一步'],
    });
  };

  const addModuleTask = () => {
    if (activeModule === 'Review') {
      window.location.hash = 'today';
      return;
    }

    const taskDetails = {
      Words: ['Review a small word set', 'Words · choose a duration'],
      Poems: ['Recite a short passage', 'Poems · choose a passage'],
    } as const;
    const [title, detail] = taskDetails[activeModule];

    setTasks((current) => [
      ...current,
      {
        id: `module-${activeModule.toLowerCase()}-${Date.now()}`,
        title,
        detail,
        type: activeModule,
        done: false,
      },
    ]);
    window.location.hash = 'today';
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="lailai's Academy home">
          <span className="brand-mark">
            <img alt="" src={`${import.meta.env.BASE_URL}brand/logo.svg`} />
          </span>
          <span className="brand-copy">
            <strong>lailai's</strong>
            <span>ACADEMY</span>
          </span>
        </a>

        <nav aria-label="Primary navigation" className="topnav">
          <a className="topnav-link active" href="#overview">
            Overview
          </a>
          <a className="topnav-link" href="#planner">
            Planner
          </a>
          <a className="topnav-link" href="#modules">
            Library
          </a>
        </nav>

        <button aria-label="Profile coming soon" className="avatar-button" disabled title="Profile coming soon" type="button">
          L
        </button>
      </header>

      <main className="page" id="overview">
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              {formatDate()}
            </p>
            <h1>
              让今天的学习
              <br />
              <span>有一个落点。</span>
            </h1>
            <p className="hero-description">
              把长期目标拆成今天能完成的一小段。先从一个动作开始，剩下的交给节奏。
            </p>
            <div className="hero-actions">
              <a className="button primary-button" href="#today">
                开始今天的学习
                <Icon name="arrow" size={18} />
              </a>
              <a className="quiet-link" href="#planner">
                让 AI 帮我规划
                <Icon name="spark" size={16} />
              </a>
            </div>
          </div>

          <aside className="focus-card" aria-label="Today's progress">
            <div className="focus-card-topline">
              <span className="status-label">
                <span className="status-dot" />
                Today at a glance
              </span>
              <Icon name="calendar" size={18} />
            </div>
            <div className="focus-number-row">
              <strong>{completedCount}</strong>
              <span>/ {tasks.length} tasks</span>
            </div>
            <p className="focus-caption">
              {progress === 0 ? '从最小的一步开始。' : `${progress}% of today's plan is complete.`}
            </p>
            <div aria-label={`${progress}% complete`} className="progress-track" role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress}>
              <span className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="focus-footer">
              <span>Keep it small</span>
              <span>{progress === 100 ? 'Complete' : 'In progress'}</span>
            </div>
          </aside>
        </section>

        <section className="content-grid" id="today">
          <article className="surface-card plan-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">Today</p>
                <h2>今日安排</h2>
              </div>
              <span className="demo-badge">示例计划</span>
            </div>

            <div className="task-list">
              {tasks.map((task) => (
                <button
                  aria-pressed={task.done}
                  className={`task-row${task.done ? ' done' : ''}`}
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  type="button"
                >
                  <span className="task-check">
                    {task.done && <Icon name="check" size={15} />}
                  </span>
                  <span className="task-copy">
                    <strong>{task.title}</strong>
                    <span>{task.detail}</span>
                  </span>
                  <span className="task-type">{task.type}</span>
                </button>
              ))}
            </div>

            <button className="add-task-button" type="button" onClick={() => setTasks((current) => [...current, { id: `task-${current.length + 1}`, title: 'A new small step', detail: 'Custom · choose a duration', type: 'Focus', done: false }])}>
              <span>+</span>
              添加一个小目标
            </button>
          </article>

          <article className="surface-card planner-card" id="planner">
            <div className="section-heading">
              <div>
                <p className="section-kicker">AI planner</p>
                <h2>把目标变成下一步</h2>
              </div>
              <span className="status-badge">Local preview</span>
            </div>
            <p className="card-description">
              先写下你想完成的事。现在是本地预览，之后可以接入你自己的 AI API。
            </p>
            <form className="planner-form" onSubmit={createPlan}>
              <label htmlFor="goal">我想学习……</label>
              <div className="planner-input-row">
                <input
                  id="goal"
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder="例如：这周掌握 100 个英语单词"
                  value={goal}
                />
                <button aria-label="Generate a plan" className="icon-button" disabled={!goal.trim()} type="submit">
                  <Icon name="arrow" size={18} />
                </button>
              </div>
            </form>
            {plan ? (
              <div className="plan-preview" role="status">
                <div className="plan-preview-heading">
                  <span className="plan-preview-icon">
                    <Icon name="spark" size={16} />
                  </span>
                  <span>
                    <strong>{plan.goal}</strong>
                    <small>今天先做这三件事</small>
                  </span>
                </div>
                <ol>
                  {plan.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <div className="planner-empty">
                <Icon name="brain" size={20} />
                <span>输入一个目标，生成一份轻量计划。</span>
              </div>
            )}
          </article>
        </section>

        <section className="modules-section" id="modules">
          <div className="section-heading modules-heading">
            <div>
              <p className="section-kicker">Your library</p>
              <h2>学习模块</h2>
            </div>
            <span className="section-note">从一个模块开始即可</span>
          </div>

          <div className="module-grid">
            {(Object.keys(moduleContent) as Array<'Words' | 'Poems' | 'Review'>).map((module) => {
              const item = moduleContent[module];
              const selected = activeModule === module;

              return (
                <button
                  aria-pressed={selected}
                  className={`module-card${selected ? ' selected' : ''}`}
                  key={module}
                  onClick={() => setActiveModule(module)}
                  type="button"
                >
                  <span className="module-icon">
                    <Icon name={item.icon} size={21} />
                  </span>
                  <span className="module-card-copy">
                    <span className="module-card-title">
                      <strong>{item.title}</strong>
                      <Icon name="arrow" size={17} />
                    </span>
                    <span className="module-card-label">{item.label}</span>
                    <span className="module-card-meta">{item.meta}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="module-detail">
            <div className="module-detail-icon">
              <Icon name={moduleContent[activeModule].icon} size={24} />
            </div>
            <div>
              <p className="section-kicker">{moduleContent[activeModule].title}</p>
              <h3>{moduleContent[activeModule].description}</h3>
            </div>
            <button className="button secondary-button" onClick={addModuleTask} type="button">
              {moduleContent[activeModule].action}
              <Icon name="arrow" size={17} />
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>lailai's Academy</span>
        <span>Make a small promise. Keep it.</span>
      </footer>
    </div>
  );
}

export default App;
