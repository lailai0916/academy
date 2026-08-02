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

type Locale = 'en' | 'zh-Hans';

const STORAGE_KEY = 'academy.tasks.v0';
const LOCALE_KEY = 'academy.locale.v0';

const messages = {
  en: {
    nav: { overview: 'Overview', planner: 'Planner', library: 'Library' },
    hero: {
      title: 'Give today’s learning a place to land.',
      description: 'Turn a long-term goal into one small piece you can finish today.',
      start: 'Start today’s study',
      plan: 'Let AI plan for me',
    },
    focus: {
      label: 'Today at a glance',
      tasks: 'tasks',
      empty: 'Start with the smallest step.',
      complete: (progress: number) => `${progress}% of today’s plan is complete.`,
      keepSmall: 'Keep it small',
      inProgress: 'In progress',
      done: 'Complete',
      taskTitle: 'One focused study session',
      taskDetail: 'Choose a topic · 25 minutes',
    },
    today: {
      kicker: 'Today',
      title: 'Today’s plan',
      badge: 'Preview plan',
      add: 'Add a small goal',
      newTask: 'A new small step',
      custom: 'Custom · choose a duration',
    },
    planner: {
      kicker: 'AI planner',
      title: 'Turn a goal into the next step',
      badge: 'Local preview',
      description: 'Write down what you want to finish. This preview stays local for now.',
      label: 'I want to learn…',
      placeholder: 'For example: learn 100 English words this week',
      generate: 'Generate a plan',
      preview: 'Start with these three steps today',
      empty: 'Enter a goal to generate a light plan.',
      steps: [
        'Make one 25-minute focus block',
        'Schedule one active-recall round',
        'Leave the next step before the day ends',
      ],
    },
    library: {
      kicker: 'Your library',
      title: 'Learning modules',
      note: 'Start with one module',
      words: {
        title: 'Words',
        label: 'Vocabulary',
        description: 'Use spaced review to turn vocabulary into small groups you can finish today.',
        action: 'Add a word task',
        meta: 'Waiting for your first set',
        task: ['Review a small word set', 'Words · choose a duration'],
      },
      poems: {
        title: 'Poems',
        label: 'Classical poems',
        description: 'Build a thread through each passage: understand first, then recite.',
        action: 'Add a poem',
        meta: 'No saved passages yet',
        task: ['Recite a short passage', 'Poems · choose a passage'],
      },
      review: {
        title: 'Review',
        label: 'Review queue',
        description: 'Turn forgetting into the next prompt and bring review back into rhythm.',
        action: 'Back to today’s plan',
        meta: 'No reviews due today',
      },
    },
    taskTypes: { Words: 'Words', Poems: 'Poems', Focus: 'Focus' },
    footer: 'Make a small promise. Keep it.',
    profile: 'Profile coming soon',
    language: '切换到简体中文',
  },
  'zh-Hans': {
    nav: { overview: '概览', planner: '规划', library: '资料库' },
    hero: {
      title: '让今天的学习有一个落点。',
      description: '把长期目标拆成今天能完成的一小段，先从一个动作开始。',
      start: '开始今天的学习',
      plan: '让 AI 帮我规划',
    },
    focus: {
      label: '今日概览',
      tasks: '项任务',
      empty: '从最小的一步开始。',
      complete: (progress: number) => `今天的计划已完成 ${progress}%。`,
      keepSmall: '保持小步前进',
      inProgress: '进行中',
      done: '已完成',
      taskTitle: '一次专注学习',
      taskDetail: '选择主题 · 25 分钟',
    },
    today: {
      kicker: '今日',
      title: '今日安排',
      badge: '示例计划',
      add: '添加一个小目标',
      newTask: '一个新的小步骤',
      custom: '自定义 · 选择时长',
    },
    planner: {
      kicker: 'AI 规划',
      title: '把目标变成下一步',
      badge: '本地预览',
      description: '先写下你想完成的事。当前是本地预览，之后可以接入自己的 AI API。',
      label: '我想学习……',
      placeholder: '例如：这周掌握 100 个英语单词',
      generate: '生成计划',
      preview: '今天先做这三件事',
      empty: '输入一个目标，生成一份轻量计划。',
      steps: ['拆成一个 25 分钟专注单元', '安排一次主动回忆', '在今天结束前留下下一步'],
    },
    library: {
      kicker: '你的资料库',
      title: '学习模块',
      note: '从一个模块开始即可',
      words: {
        title: 'Words',
        label: '单词记忆',
        description: '用间隔复习把词汇分成今天能完成的小组。',
        action: '添加单词任务',
        meta: '等待你的第一组词',
        task: ['复习一组单词', 'Words · 选择时长'],
      },
      poems: {
        title: 'Poems',
        label: '古诗文',
        description: '按篇章建立线索，从理解开始，再进入背诵。',
        action: '添加一篇古诗',
        meta: '还没有收藏内容',
        task: ['背诵一段短文', 'Poems · 选择篇章'],
      },
      review: {
        title: 'Review',
        label: '复习队列',
        description: '把遗忘变成下一次提示，让复习回到节奏里。',
        action: '回到今日安排',
        meta: '今天没有待复习项目',
      },
    },
    taskTypes: { Words: '单词', Poems: '古诗', Focus: '专注' },
    footer: '许一个小承诺，然后完成它。',
    profile: '个人资料即将开放',
    language: 'Switch to English',
  },
} as const;

function loadLocale(): Locale {
  try {
    return window.localStorage.getItem(LOCALE_KEY) === 'zh-Hans' ? 'zh-Hans' : 'en';
  } catch {
    return 'en';
  }
}

function starterTasks(locale: Locale): Task[] {
  const text = messages[locale];
  return [
    {
      id: 'words',
      title: text.library.words.task[0],
      detail: text.library.words.task[1],
      type: 'Words',
      done: false,
    },
    {
      id: 'poems',
      title: text.library.poems.task[0],
      detail: text.library.poems.task[1],
      type: 'Poems',
      done: false,
    },
    {
      id: 'focus',
      title: text.focus.taskTitle,
      detail: text.focus.taskDetail,
      type: 'Focus',
      done: false,
    },
  ];
}

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

function formatDate(locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    day: '2-digit',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
}

function loadTasks(locale: Locale): Task[] {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return starterTasks(locale);
    const parsed = JSON.parse(saved) as Task[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : starterTasks(locale);
  } catch {
    return starterTasks(locale);
  }
}

function localizeTask(task: Task, text: (typeof messages)[Locale]): Task {
  if (task.id === 'words') {
    return { ...task, title: text.library.words.task[0], detail: text.library.words.task[1] };
  }
  if (task.id === 'poems') {
    return { ...task, title: text.library.poems.task[0], detail: text.library.poems.task[1] };
  }
  if (task.id === 'focus') {
    return {
      ...task,
      title: text.focus.taskTitle,
      detail: text.focus.taskDetail,
    };
  }
  return task;
}

function App(): ReactNode {
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const text = messages[locale];
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks(locale));
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [activeModule, setActiveModule] = useState<'Words' | 'Poems' | 'Review'>('Words');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);

  const completedCount = tasks.filter((task) => task.done).length;
  const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

  const moduleContent = useMemo(
    () => ({
      Words: { icon: 'book' as IconName, ...text.library.words },
      Poems: { icon: 'feather' as IconName, ...text.library.poems },
      Review: { icon: 'refresh' as IconName, ...text.library.review },
    }),
    [text]
  );

  const toggleTask = (id: string) => {
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, done: !task.done } : task))
    );
  };

  const createPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextGoal = goal.trim();
    if (!nextGoal) return;

    setPlan({
      goal: nextGoal,
      steps: [...text.planner.steps],
    });
  };

  const addModuleTask = () => {
    if (activeModule === 'Review') {
      window.location.hash = 'today';
      return;
    }

    const taskDetails = {
      Words: text.library.words.task,
      Poems: text.library.poems.task,
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

        <nav aria-label={locale === 'en' ? 'Primary navigation' : '主导航'} className="topnav">
          <a className="topnav-link active" href="#overview">
            {text.nav.overview}
          </a>
          <a className="topnav-link" href="#planner">
            {text.nav.planner}
          </a>
          <a className="topnav-link" href="#modules">
            {text.nav.library}
          </a>
        </nav>

        <div className="topbar-actions">
          <button
            aria-label={text.language}
            className="locale-button"
            onClick={() => setLocale(locale === 'en' ? 'zh-Hans' : 'en')}
            type="button"
          >
            {locale === 'en' ? '中' : 'EN'}
          </button>
          <button
            aria-label={text.profile}
            className="avatar-button"
            disabled
            title={text.profile}
            type="button"
          >
            L
          </button>
        </div>
      </header>

      <main className="page" id="overview">
        <section className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              {formatDate(locale)}
            </p>
            <h1>
              {locale === 'en' ? (
                text.hero.title
              ) : (
                <>
                  让今天的学习
                  <br />
                  <span>有一个落点。</span>
                </>
              )}
            </h1>
            <p className="hero-description">{text.hero.description}</p>
            <div className="hero-actions">
              <a className="button primary-button" href="#today">
                {text.hero.start}
                <Icon name="arrow" size={18} />
              </a>
              <a className="quiet-link" href="#planner">
                {text.hero.plan}
                <Icon name="spark" size={16} />
              </a>
            </div>
          </div>

          <aside
            className="focus-card"
            aria-label={locale === 'en' ? "Today's progress" : '今日进度'}
          >
            <div className="focus-card-topline">
              <span className="status-label">
                <span className="status-dot" />
                {text.focus.label}
              </span>
              <Icon name="calendar" size={18} />
            </div>
            <div className="focus-number-row">
              <strong>{completedCount}</strong>
              <span>
                / {tasks.length} {text.focus.tasks}
              </span>
            </div>
            <p className="focus-caption">
              {progress === 0 ? text.focus.empty : text.focus.complete(progress)}
            </p>
            <div
              aria-label={locale === 'en' ? `${progress}% complete` : `已完成 ${progress}%`}
              className="progress-track"
              role="progressbar"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={progress}
            >
              <span className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="focus-footer">
              <span>{text.focus.keepSmall}</span>
              <span>{progress === 100 ? text.focus.done : text.focus.inProgress}</span>
            </div>
          </aside>
        </section>

        <section className="content-grid" id="today">
          <article className="surface-card plan-card">
            <div className="section-heading">
              <div>
                <p className="section-kicker">{text.today.kicker}</p>
                <h2>{text.today.title}</h2>
              </div>
              <span className="demo-badge">{text.today.badge}</span>
            </div>

            <div className="task-list">
              {tasks.map((task) => {
                const displayTask = localizeTask(task, text);

                return (
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
                      <strong>{displayTask.title}</strong>
                      <span>{displayTask.detail}</span>
                    </span>
                    <span className="task-type">{text.taskTypes[task.type]}</span>
                  </button>
                );
              })}
            </div>

            <button
              className="add-task-button"
              type="button"
              onClick={() =>
                setTasks((current) => [
                  ...current,
                  {
                    id: `task-${current.length + 1}`,
                    title: text.today.newTask,
                    detail: text.today.custom,
                    type: 'Focus',
                    done: false,
                  },
                ])
              }
            >
              <span>+</span>
              {text.today.add}
            </button>
          </article>

          <article className="surface-card planner-card" id="planner">
            <div className="section-heading">
              <div>
                <p className="section-kicker">{text.planner.kicker}</p>
                <h2>{text.planner.title}</h2>
              </div>
              <span className="status-badge">{text.planner.badge}</span>
            </div>
            <p className="card-description">{text.planner.description}</p>
            <form className="planner-form" onSubmit={createPlan}>
              <label htmlFor="goal">{text.planner.label}</label>
              <div className="planner-input-row">
                <input
                  id="goal"
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder={text.planner.placeholder}
                  value={goal}
                />
                <button
                  aria-label={text.planner.generate}
                  className="icon-button"
                  disabled={!goal.trim()}
                  type="submit"
                >
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
                    <small>{text.planner.preview}</small>
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
                <span>{text.planner.empty}</span>
              </div>
            )}
          </article>
        </section>

        <section className="modules-section" id="modules">
          <div className="section-heading modules-heading">
            <div>
              <p className="section-kicker">{text.library.kicker}</p>
              <h2>{text.library.title}</h2>
            </div>
            <span className="section-note">{text.library.note}</span>
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
        <span>{text.footer}</span>
      </footer>
    </div>
  );
}

export default App;
