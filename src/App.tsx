import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';

type Locale = 'en' | 'zh-Hans';
type Workspace = 'overview' | 'planner' | 'words' | 'poems' | 'review';
type TaskType = 'Words' | 'Poems' | 'Focus' | 'Planner';
type Rating = 'again' | 'hard' | 'good';
type IconName =
  | 'arrow'
  | 'book'
  | 'brain'
  | 'calendar'
  | 'check'
  | 'clock'
  | 'feather'
  | 'home'
  | 'plus'
  | 'refresh'
  | 'spark'
  | 'target'
  | 'trash';

type Task = {
  id: string;
  title: string;
  detail: string;
  type: TaskType;
  done: boolean;
  createdAt: string;
};

type Word = {
  id: string;
  term: string;
  meaning: string;
  meaningZh: string;
  example: string;
  dueAt: string;
  streak: number;
  mastered: boolean;
  lastReviewedAt?: string;
};

type Poem = {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  excerpt: string;
  translation: string;
  hint: string;
  dueAt: string;
  completedCount: number;
};

type AppState = {
  tasks: Task[];
  words: Word[];
  poems: Poem[];
};

type PlanPreview = {
  goal: string;
  steps: string[];
};

const STATE_KEY = 'academy.state.v1';
const OLD_TASKS_KEY = 'academy.tasks.v0';
const OLD_LOCALE_KEY = 'academy.locale.v0';
const DAY = 24 * 60 * 60 * 1000;

const messages = {
  en: {
    brand: { name: "lailai's", product: 'ACADEMY' },
    nav: {
      overview: 'Overview',
      planner: 'Planner',
      words: 'Words',
      poems: 'Poems',
      review: 'Review',
    },
    common: {
      today: 'Today',
      due: 'due',
      dueToday: 'Due today',
      completed: 'completed',
      start: 'Start',
      continue: 'Continue',
      save: 'Save',
      cancel: 'Cancel',
      add: 'Add',
      local: 'Local data',
      minutes: 'min',
      days: 'days',
      noItems: 'Nothing here yet.',
      language: '切换到简体中文',
      profile: 'Personal profile is not connected yet',
    },
    overview: {
      eyebrow: 'Your learning desk',
      title: 'Keep learning in motion.',
      description:
        'Plan a small session, practise what matters, and return when it is time to review.',
      startReview: 'Start due review',
      openPlanner: 'Plan a goal',
      progress: 'Today’s progress',
      tasks: 'tasks',
      streak: 'day streak',
      wordsReady: 'words ready',
      planTitle: 'Today’s plan',
      planDescription: 'A short list is easier to return to.',
      addPlaceholder: 'Add a small next step…',
      addTask: 'Add task',
      allDone: 'You kept the promise for today.',
      next: 'Next best action',
      nextDescription: 'Keep the loop small: recall, reflect, then schedule the next prompt.',
      recent: 'Recent activity',
      firstSession: 'Your first session starts here.',
    },
    planner: {
      eyebrow: 'Planner',
      title: 'Turn a goal into a week you can actually keep.',
      description:
        'Describe the outcome, choose a pace, and get a concrete local plan. Nothing leaves this browser.',
      localBadge: 'Local planning',
      goalLabel: 'What do you want to learn?',
      goalPlaceholder: 'e.g. Prepare for an English interview in 14 days',
      paceLabel: 'Daily focus',
      pace25: '25 min',
      pace45: '45 min',
      generate: 'Generate plan',
      previewTitle: 'Your next three moves',
      previewNote: 'This is a practical starting point, not a promise of perfect automation.',
      addPlan: 'Add these to today',
      added: 'Plan added to today',
      empty: 'Enter a goal and the planner will outline a focused first session.',
      principles: [
        'Start with retrieval, not rereading',
        'Leave a visible next step',
        'Review before adding more',
      ],
    },
    words: {
      eyebrow: 'Words',
      title: 'Build vocabulary through retrieval.',
      description:
        'Reveal one word, rate the effort, and let the next review date take care of itself.',
      due: 'Due now',
      mastered: 'mastered',
      bank: 'Word bank',
      addWord: 'Add word',
      term: 'Word',
      meaning: 'Meaning',
      meaningZh: 'Chinese meaning',
      example: 'Example sentence',
      reveal: 'Reveal meaning',
      hide: 'Hide meaning',
      again: 'Forgot',
      hard: 'Hard',
      good: 'Got it',
      nextReview: 'Next review',
      noDue: 'No words are due. Nice — come back when the queue calls you.',
      emptyBank: 'Add your first word to make this deck yours.',
      streak: 'streak',
      validation: 'Add a word and its meaning first.',
      saved: 'Word added to your bank.',
    },
    poems: {
      eyebrow: 'Poems',
      title: 'Read for meaning. Recite for memory.',
      description: 'A small classical library with prompts for understanding and recall.',
      library: 'Your collection',
      recite: 'I recited it',
      recited: 'Recited',
      translation: 'Modern reading',
      hideTranslation: 'Hide reading',
      hint: 'Memory cue',
      showHint: 'Show cue',
      hideHint: 'Hide cue',
      due: 'due',
      noDue: 'No poems are due today.',
      next: 'Next review',
      times: 'times',
    },
    review: {
      eyebrow: 'Review',
      title: 'Return to what is almost forgotten.',
      description: 'Review keeps your words and poems moving on a gentle, useful rhythm.',
      queue: 'Review queue',
      ready: 'ready now',
      word: 'word',
      poem: 'poem',
      allClear: 'You are all clear for now.',
      allClearDescription: 'A little space is part of a sustainable learning rhythm.',
      reviewWords: 'Review words',
      reviewPoems: 'Review poems',
      goWords: 'Open Words',
      goPoems: 'Open Poems',
    },
    taskTypes: { Words: 'Words', Poems: 'Poems', Focus: 'Focus', Planner: 'Planner' },
    footer: 'Make a small promise. Keep it.',
  },
  'zh-Hans': {
    brand: { name: "lailai's", product: 'ACADEMY' },
    nav: { overview: '概览', planner: '规划', words: '单词', poems: '古诗', review: '复习' },
    common: {
      today: '今天',
      due: '待复习',
      dueToday: '今日待复习',
      completed: '已完成',
      start: '开始',
      continue: '继续',
      save: '保存',
      cancel: '取消',
      add: '添加',
      local: '本地数据',
      minutes: '分钟',
      days: '天',
      noItems: '这里还没有内容。',
      language: 'Switch to English',
      profile: '个人资料暂未连接',
    },
    overview: {
      eyebrow: '你的学习桌面',
      title: '让学习保持在路上。',
      description: '安排一小段学习，练习真正重要的内容，在该复习时回来。',
      startReview: '开始待复习',
      openPlanner: '规划一个目标',
      progress: '今日进度',
      tasks: '项任务',
      streak: '天连续学习',
      wordsReady: '个单词待复习',
      planTitle: '今日安排',
      planDescription: '短一点的清单，更容易重新开始。',
      addPlaceholder: '添加一个下一步……',
      addTask: '添加任务',
      allDone: '今天的小承诺已经完成。',
      next: '下一步建议',
      nextDescription: '保持循环足够小：回忆、复盘，然后安排下一次提示。',
      recent: '最近记录',
      firstSession: '你的第一次学习就从这里开始。',
    },
    planner: {
      eyebrow: '学习规划',
      title: '把目标变成真的能坚持的一周。',
      description: '描述想要的结果、选择节奏，获得一份具体的本地计划。内容不会离开浏览器。',
      localBadge: '本地规划',
      goalLabel: '你想学习什么？',
      goalPlaceholder: '例如：14 天准备好英语面试',
      paceLabel: '每日专注时长',
      pace25: '25 分钟',
      pace45: '45 分钟',
      generate: '生成计划',
      previewTitle: '接下来的三步',
      previewNote: '这是一份务实的起点，不承诺完全自动化。',
      addPlan: '加入今日安排',
      added: '计划已加入今日安排',
      empty: '输入目标，规划器会给出一次专注学习的起点。',
      principles: ['先主动回忆，再重新阅读', '留下清晰可见的下一步', '复习之后再继续增加内容'],
    },
    words: {
      eyebrow: '单词记忆',
      title: '用主动回忆建立词汇量。',
      description: '翻开一个词，按真实难度自评，下一次复习会自动安排。',
      due: '现在待复习',
      mastered: '已掌握',
      bank: '单词库',
      addWord: '添加单词',
      term: '单词',
      meaning: '英文释义',
      meaningZh: '中文释义',
      example: '例句',
      reveal: '查看释义',
      hide: '隐藏释义',
      again: '忘记了',
      hard: '有点模糊',
      good: '认识',
      nextReview: '下次复习',
      noDue: '今天没有待复习单词。很好，等队列再次提醒你。',
      emptyBank: '添加第一个单词，让这组卡片真正属于你。',
      streak: '连对',
      validation: '请先填写单词和释义。',
      saved: '单词已加入词库。',
    },
    poems: {
      eyebrow: '古诗文',
      title: '先读懂，再背下来。',
      description: '一组小而克制的古诗文，配合理解提示与主动背诵。',
      library: '你的收藏',
      recite: '我已背诵',
      recited: '已背诵',
      translation: '白话理解',
      hideTranslation: '隐藏理解',
      hint: '记忆提示',
      showHint: '显示提示',
      hideHint: '隐藏提示',
      due: '待复习',
      noDue: '今天没有待复习古诗。',
      next: '下次复习',
      times: '次',
    },
    review: {
      eyebrow: '复习队列',
      title: '回到那些快要忘记的内容。',
      description: '让单词和古诗保持一个温和、有效的复习节奏。',
      queue: '复习队列',
      ready: '现在可以开始',
      word: '个单词',
      poem: '篇古诗',
      allClear: '目前全部清空。',
      allClearDescription: '留一点空白，也是可持续学习的一部分。',
      reviewWords: '复习单词',
      reviewPoems: '复习古诗',
      goWords: '打开单词',
      goPoems: '打开古诗',
    },
    taskTypes: { Words: '单词', Poems: '古诗', Focus: '专注', Planner: '规划' },
    footer: '许一个小承诺，然后完成它。',
  },
} as const;

type Copy = (typeof messages)[Locale];

const todayIso = () => new Date().toISOString();
const addDays = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const isDue = (date: string) => new Date(date).getTime() <= Date.now();

function formatDate(locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(new Date());
}

function formatShortDate(date: string, locale: Locale): string {
  const value = new Date(date);
  if (isDue(date)) return locale === 'en' ? 'Now' : '现在';
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(value);
}

function starterTasks(locale: Locale): Task[] {
  const text = messages[locale];
  return [
    {
      id: 'starter-words',
      title: locale === 'en' ? 'Review five words' : '复习 5 个单词',
      detail: locale === 'en' ? 'Words · 10 minutes' : '单词 · 10 分钟',
      type: 'Words',
      done: false,
      createdAt: todayIso(),
    },
    {
      id: 'starter-poems',
      title: locale === 'en' ? 'Recite one passage' : '背诵一段古诗',
      detail: locale === 'en' ? 'Poems · 10 minutes' : '古诗 · 10 分钟',
      type: 'Poems',
      done: false,
      createdAt: todayIso(),
    },
    {
      id: 'starter-focus',
      title: locale === 'en' ? 'One focused session' : '完成一次专注学习',
      detail: locale === 'en' ? 'Focus · 25 minutes' : '专注 · 25 分钟',
      type: 'Focus',
      done: false,
      createdAt: todayIso(),
    },
  ];
}

function seedWords(): Word[] {
  return [
    {
      id: 'deliberate',
      term: 'deliberate',
      meaning: 'done consciously and intentionally',
      meaningZh: '有意识的；故意的',
      example: 'Small, deliberate practice beats occasional intensity.',
      dueAt: addDays(-1),
      streak: 1,
      mastered: false,
    },
    {
      id: 'resilient',
      term: 'resilient',
      meaning: 'able to recover quickly from difficulty',
      meaningZh: '有韧性的；能迅速恢复的',
      example: 'A resilient routine leaves room for imperfect days.',
      dueAt: addDays(-1),
      streak: 2,
      mastered: false,
    },
    {
      id: 'nuance',
      term: 'nuance',
      meaning: 'a subtle difference in meaning or expression',
      meaningZh: '细微差别；语气上的微妙之处',
      example: 'Reading widely helps you notice nuance.',
      dueAt: addDays(1),
      streak: 3,
      mastered: false,
    },
    {
      id: 'sustain',
      term: 'sustain',
      meaning: 'to keep something going over time',
      meaningZh: '维持；使持续下去',
      example: 'Design a pace you can sustain for a season.',
      dueAt: addDays(2),
      streak: 4,
      mastered: true,
    },
    {
      id: 'curiosity',
      term: 'curiosity',
      meaning: 'a strong desire to know or learn something',
      meaningZh: '好奇心；求知欲',
      example: 'Curiosity makes a difficult topic worth returning to.',
      dueAt: addDays(-1),
      streak: 0,
      mastered: false,
    },
  ];
}

function seedPoems(): Poem[] {
  return [
    {
      id: '静夜思',
      title: '静夜思',
      author: '李白',
      dynasty: '唐',
      excerpt: '床前明月光，\n疑是地上霜。\n举头望明月，\n低头思故乡。',
      translation: '月光照在床前，仿佛地上泛起了一层白霜。抬头看着明月，低头又想起远方的故乡。',
      hint: '霜 → 月 → 举头 → 低头，画面从眼前回到故乡。',
      dueAt: addDays(-1),
      completedCount: 0,
    },
    {
      id: '江雪',
      title: '江雪',
      author: '柳宗元',
      dynasty: '唐',
      excerpt: '千山鸟飞绝，万径人踪灭。\n孤舟蓑笠翁，独钓寒江雪。',
      translation:
        '群山中看不到飞鸟，所有道路都没有人的踪迹。只有一位披蓑戴笠的老人，独自在寒冷的江面上垂钓。',
      hint: '从千山、万径的空寂，收束到孤舟上的一个人。',
      dueAt: addDays(0),
      completedCount: 2,
    },
    {
      id: '春晓',
      title: '春晓',
      author: '孟浩然',
      dynasty: '唐',
      excerpt: '春眠不觉晓，处处闻啼鸟。\n夜来风雨声，花落知多少。',
      translation:
        '春日睡得香甜，不知不觉天已亮了，到处都能听见鸟叫。昨夜听到风雨声，不知道有多少花儿被吹落了。',
      hint: '从听见鸟声，到回想昨夜风雨，再落到花。',
      dueAt: addDays(3),
      completedCount: 1,
    },
  ];
}

function loadLocale(): Locale {
  try {
    return window.localStorage.getItem(OLD_LOCALE_KEY) === 'zh-Hans' ? 'zh-Hans' : 'en';
  } catch {
    return 'en';
  }
}

function loadState(locale: Locale): AppState {
  try {
    const stored = window.localStorage.getItem(STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppState>;
      if (
        Array.isArray(parsed.tasks) &&
        Array.isArray(parsed.words) &&
        Array.isArray(parsed.poems)
      ) {
        return { tasks: parsed.tasks, words: parsed.words, poems: parsed.poems };
      }
    }
    const oldTasks = window.localStorage.getItem(OLD_TASKS_KEY);
    if (oldTasks) {
      const parsed = JSON.parse(oldTasks) as Array<Partial<Task>>;
      if (Array.isArray(parsed)) {
        return {
          tasks: parsed.map((task, index) => ({
            id: task.id || `migrated-${index}`,
            title: task.title || '',
            detail: task.detail || '',
            type: task.type === 'Poems' || task.type === 'Words' ? task.type : 'Focus',
            done: Boolean(task.done),
            createdAt: todayIso(),
          })),
          words: seedWords(),
          poems: seedPoems(),
        };
      }
    }
  } catch {
    // Fall through to the quiet starter state below.
  }
  return { tasks: starterTasks(locale), words: seedWords(), poems: seedPoems() };
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
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
    feather: (
      <>
        <path d="M20.5 3.5C13 2.8 7.8 6.3 7.2 13.3c-.2 2.2.7 4 2.8 5.2 1.4.8 3.1.2 4.2-1.1C17.4 13.4 18.2 8.7 20.5 3.5Z" />
        <path d="M4 20c3.7-3.6 7.5-6.9 12.4-10.2M5.5 16.5H9M8.2 12.5h3" />
      </>
    ),
    home: (
      <>
        <path d="m4 10 8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
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
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <path d="m16 8 4-4M16 4h4v4" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </>
    ),
  };
  return (
    <svg aria-hidden="true" height={size} viewBox="0 0 24 24" width={size} {...common}>
      {paths[name]}
    </svg>
  );
}

function App(): ReactNode {
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const text = messages[locale];
  const [state, setState] = useState<AppState>(() => loadState(locale));
  const [workspace, setWorkspace] = useState<Workspace>(() => {
    const hash = window.location.hash.slice(1) as Workspace;
    return ['overview', 'planner', 'words', 'poems', 'review'].includes(hash) ? hash : 'overview';
  });
  const [goal, setGoal] = useState('');
  const [pace, setPace] = useState<25 | 45>(25);
  const [plan, setPlan] = useState<PlanPreview | null>(null);
  const [taskInput, setTaskInput] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [wordRevealed, setWordRevealed] = useState(false);
  const [wordFormOpen, setWordFormOpen] = useState(false);
  const [newWord, setNewWord] = useState({ term: '', meaning: '', meaningZh: '', example: '' });
  const [wordNotice, setWordNotice] = useState('');
  const [poemId, setPoemId] = useState('静夜思');
  const [showTranslation, setShowTranslation] = useState(true);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(OLD_LOCALE_KEY, locale);
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
  }, [locale]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.slice(1) as Workspace;
      if (['overview', 'planner', 'words', 'poems', 'review'].includes(hash)) setWorkspace(hash);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const goTo = (next: Workspace) => {
    setWorkspace(next);
    window.location.hash = next;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const dueWords = useMemo(() => state.words.filter((word) => isDue(word.dueAt)), [state.words]);
  const duePoems = useMemo(() => state.poems.filter((poem) => isDue(poem.dueAt)), [state.poems]);
  const completedTasks = state.tasks.filter((task) => task.done).length;
  const progress = state.tasks.length ? Math.round((completedTasks / state.tasks.length) * 100) : 0;
  const streak = state.words.length
    ? Math.min(21, Math.max(...state.words.map((word) => word.streak)))
    : 0;
  const currentWord = dueWords[wordIndex % Math.max(1, dueWords.length)] || state.words[0];
  const currentPoem = state.poems.find((poem) => poem.id === poemId) || state.poems[0];

  const setTaskDone = (id: string) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    }));
  };

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskInput.trim();
    if (!title) return;
    setState((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: `task-${Date.now()}`,
          title,
          detail: locale === 'en' ? 'Focus · 25 min' : '专注 · 25 分钟',
          type: 'Focus',
          done: false,
          createdAt: todayIso(),
        },
      ],
    }));
    setTaskInput('');
  };

  const createPlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextGoal = goal.trim();
    if (!nextGoal) return;
    const focusLabel = locale === 'en' ? `${pace}-minute focus block` : `${pace} 分钟专注单元`;
    setPlan({
      goal: nextGoal,
      steps:
        locale === 'en'
          ? [
              `Define one visible outcome for “${nextGoal}”`,
              `Use one ${focusLabel} with active recall`,
              'Write the next prompt before you stop',
            ]
          : [
              `为“${nextGoal}”写下一个可见结果`,
              `用一次 ${focusLabel} 做主动回忆`,
              '结束前写下下一次复习提示',
            ],
    });
  };

  const addPlanToToday = () => {
    if (!plan) return;
    setState((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        ...plan.steps.map((step, index) => ({
          id: `plan-${Date.now()}-${index}`,
          title: step,
          detail: locale === 'en' ? 'Planner · today' : '规划 · 今天',
          type: 'Planner' as TaskType,
          done: false,
          createdAt: todayIso(),
        })),
      ],
    }));
    setPlan(null);
    goTo('overview');
  };

  const reviewWord = (rating: Rating) => {
    if (!currentWord) return;
    const intervals: Record<Rating, number> = {
      again: 0.25,
      hard: 1,
      good: currentWord.streak >= 3 ? 7 : 3,
    };
    setState((current) => ({
      ...current,
      words: current.words.map((word) =>
        word.id === currentWord.id
          ? {
              ...word,
              dueAt: addDays(intervals[rating]),
              streak:
                rating === 'good'
                  ? word.streak + 1
                  : rating === 'hard'
                    ? Math.max(0, word.streak)
                    : 0,
              mastered: rating === 'good' && word.streak >= 4,
              lastReviewedAt: todayIso(),
            }
          : word
      ),
    }));
    setWordRevealed(false);
    setWordIndex((index) => index + 1);
  };

  const saveWord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newWord.term.trim() || !newWord.meaning.trim()) {
      setWordNotice(text.words.validation);
      return;
    }
    setState((current) => ({
      ...current,
      words: [
        ...current.words,
        {
          id: `word-${Date.now()}`,
          term: newWord.term.trim(),
          meaning: newWord.meaning.trim(),
          meaningZh: newWord.meaningZh.trim() || newWord.meaning.trim(),
          example: newWord.example.trim() || 'Make your own example sentence.',
          dueAt: todayIso(),
          streak: 0,
          mastered: false,
        },
      ],
    }));
    setNewWord({ term: '', meaning: '', meaningZh: '', example: '' });
    setWordFormOpen(false);
    setWordNotice(text.words.saved);
  };

  const recitePoem = () => {
    if (!currentPoem) return;
    setState((current) => ({
      ...current,
      poems: current.poems.map((poem) =>
        poem.id === currentPoem.id
          ? {
              ...poem,
              completedCount: poem.completedCount + 1,
              dueAt: addDays(poem.completedCount >= 2 ? 7 : 2),
            }
          : poem
      ),
    }));
  };

  const navItems: Array<{ id: Workspace; icon: IconName }> = [
    { id: 'overview', icon: 'home' },
    { id: 'planner', icon: 'target' },
    { id: 'words', icon: 'book' },
    { id: 'poems', icon: 'feather' },
    { id: 'review', icon: 'refresh' },
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#overview" onClick={() => goTo('overview')}>
            <span className="brand-mark">
              <img alt="" src={`${import.meta.env.BASE_URL}brand/logo.svg`} />
            </span>
            <span className="brand-copy">
              <strong>{text.brand.name}</strong>
              <span>{text.brand.product}</span>
            </span>
          </a>
          <nav aria-label={locale === 'en' ? 'Primary navigation' : '主导航'} className="topnav">
            {navItems.map((item) => (
              <button
                className={`nav-item${workspace === item.id ? ' active' : ''}`}
                key={item.id}
                onClick={() => goTo(item.id)}
                type="button"
              >
                <span>{text.nav[item.id]}</span>
                {item.id === 'review' && dueWords.length + duePoems.length > 0 && (
                  <em>{dueWords.length + duePoems.length}</em>
                )}
              </button>
            ))}
          </nav>
          <div className="topbar-actions">
            <span className="date-label">{formatDate(locale)}</span>
            <button
              className="locale-button"
              aria-label={text.common.language}
              onClick={() => setLocale(locale === 'en' ? 'zh-Hans' : 'en')}
              type="button"
            >
              {locale === 'en' ? '中' : 'EN'}
            </button>
          </div>
        </div>
      </header>

      <div className="main-shell">
        <main className="content" id="main-content">
          {workspace === 'overview' && (
            <section className="view overview-view" aria-labelledby="overview-title">
              <div className="view-intro overview-intro">
                <div>
                  <p className="eyebrow">{text.overview.eyebrow}</p>
                  <h1 id="overview-title">{text.overview.title}</h1>
                  <p className="lead">{text.overview.description}</p>
                </div>
                <div className="intro-actions">
                  <button
                    className="button primary-button"
                    onClick={() => goTo(dueWords.length ? 'words' : 'planner')}
                    type="button"
                  >
                    {dueWords.length ? text.overview.startReview : text.overview.openPlanner}
                    <Icon name="arrow" size={17} />
                  </button>
                  <span className="quiet-note">
                    <Icon name="clock" size={15} /> {text.common.local}
                  </span>
                </div>
              </div>
              <div className="overview-grid">
                <article className="panel plan-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow small">{text.overview.planTitle}</p>
                      <h2>{text.overview.planDescription}</h2>
                    </div>
                    <span className="count-badge">
                      {completedTasks}/{state.tasks.length}
                    </span>
                  </div>
                  <div className="task-list">
                    {state.tasks.map((task) => (
                      <button
                        aria-pressed={task.done}
                        className={`task-row${task.done ? ' done' : ''}`}
                        key={task.id}
                        onClick={() => setTaskDone(task.id)}
                        type="button"
                      >
                        <span className="task-check">
                          {task.done && <Icon name="check" size={14} />}
                        </span>
                        <span className="task-copy">
                          <strong>{task.title}</strong>
                          <span>{task.detail}</span>
                        </span>
                        <span className="task-type">{text.taskTypes[task.type]}</span>
                      </button>
                    ))}
                  </div>
                  {completedTasks === state.tasks.length && state.tasks.length > 0 && (
                    <p className="success-note">
                      <Icon name="check" size={15} /> {text.overview.allDone}
                    </p>
                  )}
                  <form className="add-task-form" onSubmit={addTask}>
                    <input
                      aria-label={text.overview.addPlaceholder}
                      onChange={(event) => setTaskInput(event.target.value)}
                      placeholder={text.overview.addPlaceholder}
                      value={taskInput}
                    />
                    <button
                      aria-label={text.overview.addTask}
                      className="icon-button"
                      disabled={!taskInput.trim()}
                      type="submit"
                    >
                      <Icon name="plus" size={17} />
                    </button>
                  </form>
                </article>
                <aside className="panel next-panel">
                  <span className="panel-icon">
                    <Icon name="spark" size={18} />
                  </span>
                  <p className="eyebrow small">{text.overview.next}</p>
                  <h2>{text.overview.nextDescription}</h2>
                  <div className="next-actions">
                    <button className="text-button" onClick={() => goTo('review')} type="button">
                      {text.common.continue}
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>
                  <div className="activity-line">
                    <span className="activity-dot" />
                    <span>{text.overview.recent}</span>
                    <time>
                      {state.words.filter((word) => word.lastReviewedAt).length}{' '}
                      {text.common.completed}
                    </time>
                  </div>
                </aside>
              </div>
              <div
                className="module-bento"
                aria-label={locale === 'en' ? 'Learning modules' : '学习模块'}
              >
                {navItems
                  .filter((item) => item.id !== 'overview')
                  .map((item) => (
                    <button
                      className="module-card panel"
                      key={item.id}
                      onClick={() => goTo(item.id)}
                      type="button"
                    >
                      <span className="module-card-icon">
                        <Icon name={item.icon} size={18} />
                      </span>
                      <span className="module-card-copy">
                        <strong>{text.nav[item.id]}</strong>
                        <small>
                          {item.id === 'planner' &&
                            (locale === 'en' ? 'Shape the next session' : '安排下一次学习')}
                          {item.id === 'words' &&
                            (locale === 'en'
                              ? `${dueWords.length} ready to recall`
                              : `${dueWords.length} 个单词待回忆`)}
                          {item.id === 'poems' &&
                            (locale === 'en'
                              ? `${state.poems.length} passages in your shelf`
                              : `书架上有 ${state.poems.length} 篇古诗`)}
                          {item.id === 'review' &&
                            (locale === 'en'
                              ? `${dueWords.length + duePoems.length} items in queue`
                              : `队列中有 ${dueWords.length + duePoems.length} 项`)}
                        </small>
                      </span>
                      <span className="module-card-arrow">
                        <Icon name="arrow" size={16} />
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          )}

          {workspace === 'planner' && (
            <section className="view" aria-labelledby="planner-title">
              <div className="view-intro compact-intro">
                <div>
                  <p className="eyebrow">
                    <span className="eyebrow-dot" />
                    {text.planner.eyebrow}
                  </p>
                  <h1 id="planner-title">{text.planner.title}</h1>
                  <p className="lead">{text.planner.description}</p>
                </div>
                <span className="soft-badge">
                  <Icon name="brain" size={15} />
                  {text.planner.localBadge}
                </span>
              </div>
              <div className="planner-layout">
                <article className="panel planner-form-panel">
                  <form onSubmit={createPlan}>
                    <label htmlFor="goal">{text.planner.goalLabel}</label>
                    <textarea
                      id="goal"
                      onChange={(event) => setGoal(event.target.value)}
                      placeholder={text.planner.goalPlaceholder}
                      rows={4}
                      value={goal}
                    />
                    <div className="form-row">
                      <div>
                        <label htmlFor="pace">{text.planner.paceLabel}</label>
                        <select
                          id="pace"
                          onChange={(event) => setPace(Number(event.target.value) as 25 | 45)}
                          value={pace}
                        >
                          <option value={25}>{text.planner.pace25}</option>
                          <option value={45}>{text.planner.pace45}</option>
                        </select>
                      </div>
                      <button
                        className="button primary-button"
                        disabled={!goal.trim()}
                        type="submit"
                      >
                        {text.planner.generate}
                        <Icon name="spark" size={16} />
                      </button>
                    </div>
                  </form>
                  <div className="principles">
                    {text.planner.principles.map((principle, index) => (
                      <div key={principle}>
                        <span>0{index + 1}</span>
                        <p>{principle}</p>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="panel plan-preview-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow small">{text.planner.previewTitle}</p>
                      <h2>{plan ? plan.goal : text.planner.empty}</h2>
                    </div>
                    {plan && (
                      <span className="soft-badge">
                        {pace} {text.common.minutes}
                      </span>
                    )}
                  </div>
                  {plan ? (
                    <>
                      <ol className="plan-steps">
                        {plan.steps.map((step) => (
                          <li key={step}>
                            <span>
                              <Icon name="check" size={14} />
                            </span>
                            {step}
                          </li>
                        ))}
                      </ol>
                      <p className="panel-note">{text.planner.previewNote}</p>
                      <button
                        className="button secondary-button"
                        onClick={addPlanToToday}
                        type="button"
                      >
                        {text.planner.addPlan}
                        <Icon name="arrow" size={16} />
                      </button>
                    </>
                  ) : (
                    <div className="empty-state">
                      <Icon name="target" size={28} />
                      <p>{text.planner.empty}</p>
                    </div>
                  )}
                </article>
              </div>
            </section>
          )}

          {workspace === 'words' && (
            <section className="view" aria-labelledby="words-title">
              <div className="view-intro compact-intro">
                <div>
                  <p className="eyebrow">
                    <span className="eyebrow-dot" />
                    {text.words.eyebrow}
                  </p>
                  <h1 id="words-title">{text.words.title}</h1>
                  <p className="lead">{text.words.description}</p>
                </div>
                <button
                  className="button secondary-button"
                  onClick={() => setWordFormOpen((open) => !open)}
                  type="button"
                >
                  <Icon name="plus" size={16} />
                  {text.words.addWord}
                </button>
              </div>
              <div className="module-stats">
                <div>
                  <strong>{dueWords.length}</strong>
                  <span>{text.words.due}</span>
                </div>
                <div>
                  <strong>{state.words.filter((word) => word.mastered).length}</strong>
                  <span>{text.words.mastered}</span>
                </div>
                <div>
                  <strong>{state.words.length}</strong>
                  <span>{text.words.bank}</span>
                </div>
              </div>
              {wordFormOpen && (
                <form className="panel add-word-form" onSubmit={saveWord}>
                  <div>
                    <label htmlFor="new-term">{text.words.term}</label>
                    <input
                      id="new-term"
                      onChange={(event) =>
                        setNewWord((word) => ({ ...word, term: event.target.value }))
                      }
                      value={newWord.term}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-meaning">{text.words.meaning}</label>
                    <input
                      id="new-meaning"
                      onChange={(event) =>
                        setNewWord((word) => ({ ...word, meaning: event.target.value }))
                      }
                      value={newWord.meaning}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-meaning-zh">{text.words.meaningZh}</label>
                    <input
                      id="new-meaning-zh"
                      onChange={(event) =>
                        setNewWord((word) => ({ ...word, meaningZh: event.target.value }))
                      }
                      value={newWord.meaningZh}
                    />
                  </div>
                  <div>
                    <label htmlFor="new-example">{text.words.example}</label>
                    <input
                      id="new-example"
                      onChange={(event) =>
                        setNewWord((word) => ({ ...word, example: event.target.value }))
                      }
                      value={newWord.example}
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      className="button secondary-button"
                      onClick={() => setWordFormOpen(false)}
                      type="button"
                    >
                      {text.common.cancel}
                    </button>
                    <button className="button primary-button" type="submit">
                      {text.common.save}
                    </button>
                  </div>
                </form>
              )}
              {wordNotice && (
                <p className="inline-notice" role="status">
                  {wordNotice}
                </p>
              )}
              <div className="words-layout">
                <article className="flashcard panel">
                  {currentWord ? (
                    <>
                      <div className="flashcard-top">
                        <span className="soft-badge">
                          {dueWords.length ? text.words.due : text.words.bank}
                        </span>
                        <span className="word-index">
                          {Math.min(wordIndex + 1, Math.max(1, dueWords.length))} /{' '}
                          {Math.max(1, dueWords.length)}
                        </span>
                      </div>
                      <div className="word-face">
                        <span className="word-label">
                          {locale === 'en' ? 'Recall this word' : '先回忆这个词'}
                        </span>
                        <h2>{currentWord.term}</h2>
                        {wordRevealed ? (
                          <div className="word-answer">
                            <strong>
                              {locale === 'en' ? currentWord.meaning : currentWord.meaningZh}
                            </strong>
                            <p>{currentWord.example}</p>
                          </div>
                        ) : (
                          <button
                            className="reveal-button"
                            onClick={() => setWordRevealed(true)}
                            type="button"
                          >
                            <Icon name="brain" size={18} />
                            {text.words.reveal}
                          </button>
                        )}
                      </div>
                      {wordRevealed && (
                        <div className="rating-row">
                          <button
                            className="rating-button again"
                            onClick={() => reviewWord('again')}
                            type="button"
                          >
                            <strong>{text.words.again}</strong>
                            <small>15 min</small>
                          </button>
                          <button
                            className="rating-button hard"
                            onClick={() => reviewWord('hard')}
                            type="button"
                          >
                            <strong>{text.words.hard}</strong>
                            <small>1 {text.common.days}</small>
                          </button>
                          <button
                            className="rating-button good"
                            onClick={() => reviewWord('good')}
                            type="button"
                          >
                            <strong>{text.words.good}</strong>
                            <small>
                              {currentWord.streak >= 3 ? 7 : 3} {text.common.days}
                            </small>
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-state">
                      <Icon name="book" size={28} />
                      <p>{text.words.emptyBank}</p>
                    </div>
                  )}
                </article>
                <aside className="panel word-list-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow small">{text.words.bank}</p>
                      <h2>
                        {state.words.length} {locale === 'en' ? 'saved words' : '个已保存单词'}
                      </h2>
                    </div>
                    <Icon name="book" size={19} />
                  </div>
                  <div className="compact-list">
                    {state.words.map((word) => (
                      <button
                        className={`compact-list-row${currentWord?.id === word.id ? ' selected' : ''}`}
                        key={word.id}
                        onClick={() => {
                          const index = dueWords.findIndex((item) => item.id === word.id);
                          if (index >= 0) setWordIndex(index);
                          setWordRevealed(false);
                        }}
                        type="button"
                      >
                        <span>
                          <strong>{word.term}</strong>
                          <small>
                            {word.mastered
                              ? text.words.mastered
                              : `${word.streak} ${text.words.streak}`}
                          </small>
                        </span>
                        <time>{formatShortDate(word.dueAt, locale)}</time>
                      </button>
                    ))}
                  </div>
                </aside>
              </div>
            </section>
          )}

          {workspace === 'poems' && (
            <section className="view" aria-labelledby="poems-title">
              <div className="view-intro compact-intro">
                <div>
                  <p className="eyebrow">
                    <span className="eyebrow-dot" />
                    {text.poems.eyebrow}
                  </p>
                  <h1 id="poems-title">{text.poems.title}</h1>
                  <p className="lead">{text.poems.description}</p>
                </div>
                <span className="soft-badge">
                  <Icon name="feather" size={15} />
                  {state.poems.length} {text.poems.library}
                </span>
              </div>
              <div className="poems-layout">
                <aside className="poem-library panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow small">{text.poems.library}</p>
                      <h2>
                        {state.poems.length} {locale === 'en' ? 'passages' : '篇古诗'}
                      </h2>
                    </div>
                  </div>
                  {state.poems.map((poem) => (
                    <button
                      className={`poem-select${currentPoem?.id === poem.id ? ' selected' : ''}`}
                      key={poem.id}
                      onClick={() => {
                        setPoemId(poem.id);
                        setShowHint(false);
                      }}
                      type="button"
                    >
                      <span>
                        <strong>{poem.title}</strong>
                        <small>
                          {poem.author} · {poem.dynasty}
                        </small>
                      </span>
                      <span className="poem-due">
                        {isDue(poem.dueAt) ? text.poems.due : formatShortDate(poem.dueAt, locale)}
                      </span>
                    </button>
                  ))}
                </aside>
                <article className="panel poem-reader">
                  {currentPoem && (
                    <>
                      <div className="poem-heading">
                        <div>
                          <p className="eyebrow small">
                            {currentPoem.dynasty} · {currentPoem.author}
                          </p>
                          <h2>{currentPoem.title}</h2>
                        </div>
                        <span className="poem-count">
                          {currentPoem.completedCount} {text.poems.times}
                        </span>
                      </div>
                      <blockquote>{currentPoem.excerpt}</blockquote>
                      <div className="reader-controls">
                        <button
                          className="text-button"
                          onClick={() => setShowTranslation((show) => !show)}
                          type="button"
                        >
                          {showTranslation ? text.poems.hideTranslation : text.poems.translation}
                          <span>↗</span>
                        </button>
                        <button
                          className="text-button"
                          onClick={() => setShowHint((show) => !show)}
                          type="button"
                        >
                          {showHint ? text.poems.hideHint : text.poems.showHint}
                          <Icon name="spark" size={14} />
                        </button>
                      </div>
                      {showTranslation && (
                        <div className="reading-box">
                          <span className="eyebrow small">{text.poems.translation}</span>
                          <p>{currentPoem.translation}</p>
                        </div>
                      )}
                      {showHint && (
                        <div className="hint-box">
                          <span className="eyebrow small">{text.poems.hint}</span>
                          <p>{currentPoem.hint}</p>
                        </div>
                      )}
                      <div className="poem-footer">
                        <span>
                          <Icon name="calendar" size={15} />
                          {text.poems.next}: {formatShortDate(currentPoem.dueAt, locale)}
                        </span>
                        <button
                          className="button primary-button"
                          onClick={recitePoem}
                          type="button"
                        >
                          <Icon name="check" size={16} />
                          {text.poems.recite}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              </div>
            </section>
          )}

          {workspace === 'review' && (
            <section className="view" aria-labelledby="review-title">
              <div className="view-intro compact-intro">
                <div>
                  <p className="eyebrow">
                    <span className="eyebrow-dot" />
                    {text.review.eyebrow}
                  </p>
                  <h1 id="review-title">{text.review.title}</h1>
                  <p className="lead">{text.review.description}</p>
                </div>
                <span className="soft-badge">
                  <Icon name="refresh" size={15} />
                  {dueWords.length + duePoems.length} {text.review.ready}
                </span>
              </div>
              <div className="review-summary panel">
                <div>
                  <span className="eyebrow small">{text.review.queue}</span>
                  <strong>{dueWords.length + duePoems.length}</strong>
                  <p>
                    {dueWords.length} {text.review.word} · {duePoems.length} {text.review.poem}
                  </p>
                </div>
                <div
                  className="review-ring"
                  style={
                    {
                      '--ring-progress': `${Math.min(100, (completedTasks / Math.max(1, state.tasks.length)) * 100)}%`,
                    } as React.CSSProperties
                  }
                >
                  <span>{progress}%</span>
                </div>
              </div>
              {dueWords.length + duePoems.length === 0 ? (
                <div className="panel all-clear">
                  <span className="success-icon">
                    <Icon name="check" size={23} />
                  </span>
                  <h2>{text.review.allClear}</h2>
                  <p>{text.review.allClearDescription}</p>
                  <button
                    className="button secondary-button"
                    onClick={() => goTo('planner')}
                    type="button"
                  >
                    {text.overview.openPlanner}
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              ) : (
                <div className="review-actions">
                  <button
                    className="review-action panel"
                    disabled={!dueWords.length}
                    onClick={() => goTo('words')}
                    type="button"
                  >
                    <span className="panel-icon">
                      <Icon name="book" size={19} />
                    </span>
                    <span>
                      <strong>{text.review.reviewWords}</strong>
                      <small>
                        {dueWords.length} {text.review.word} {text.review.ready}
                      </small>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                  <button
                    className="review-action panel"
                    disabled={!duePoems.length}
                    onClick={() => goTo('poems')}
                    type="button"
                  >
                    <span className="panel-icon">
                      <Icon name="feather" size={19} />
                    </span>
                    <span>
                      <strong>{text.review.reviewPoems}</strong>
                      <small>
                        {duePoems.length} {text.review.poem} {text.review.ready}
                      </small>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
              )}
            </section>
          )}
        </main>
        <footer className="footer">
          <span>lailai's Academy</span>
          <span>{text.footer}</span>
        </footer>
      </div>
    </div>
  );
}

export default App;
