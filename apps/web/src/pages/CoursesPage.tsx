import { useEffect, useState } from 'react';
import { Button, Panel, Progress } from '@lailai0916/ui';
import {
  courseStatusLabels,
  curriculumCatalog,
  type CourseListItem,
  type CourseProgressStatus,
} from '@lailai/academy-shared';
import { Link, useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './CoursesPage.module.css';

const subjectIcons = {
  chinese: 'lucide:book-text',
  mathematics: 'lucide:sigma',
  english: 'lucide:languages',
  physics: 'lucide:atom',
  chemistry: 'lucide:flask-conical',
  technology: 'lucide:circuit-board',
} as const;

const memoryLinks = {
  word: { label: '英语词汇', href: '/learn/words' },
  poem: { label: '古诗词', href: '/learn/poems' },
} as const;

const progressLabels: Record<CourseProgressStatus, string> = {
  'not-started': '尚未开始',
  'lesson-in-progress': '课堂进行中',
  'retest-scheduled': '等待延迟复测',
  'retest-due': '复测已到期',
  'retest-in-progress': '复测进行中',
  completed: '课程与复测已完成',
};

function courseAction(course: CourseListItem) {
  switch (course.progress.status) {
    case 'lesson-in-progress':
      return '继续课程';
    case 'retest-scheduled':
      return '复测尚未到期';
    case 'retest-due':
      return '开始延迟复测';
    case 'retest-in-progress':
      return '继续延迟复测';
    case 'completed':
      return '查看学习结果';
    default:
      return '开始课程';
  }
}

export function CoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pilot = courses[0];

  useEffect(() => {
    api<{ courses: CourseListItem[] }>('/courses')
      .then((response) => setCourses(response.courses))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, []);

  const start = async (course: CourseListItem) => {
    if (starting || course.progress.status === 'retest-scheduled') return;
    if (course.progress.runId) {
      navigate(`/courses/${course.slug}/run/${course.progress.runId}`);
      return;
    }
    setStarting(true);
    setError('');
    try {
      const response = await api<{ runId: string }>(`/courses/${course.slug}/start`, {
        method: 'POST',
      });
      navigate(`/courses/${course.slug}/run/${response.runId}`);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageHeadingGroup}>
          <h1 className={page.pageHeading}>学科课程</h1>
          <p className={page.pageDescription}>课程教学与记忆训练分开记录，再由长期计划统一安排。</p>
        </div>
      </header>

      <Panel feature className={styles.milestone}>
        <span className={styles.milestoneIcon}>
          <Icon icon="lucide:route" />
        </span>
        <div>
          <span>当前试用</span>
          <h2>动量定理课程已接入完整学习链路</h2>
          <p>课堂可中断恢复，练习记录提示使用，独立测评完成后会安排延迟复测。</p>
        </div>
        <span className={styles.status} data-status="pilot">
          试用中
        </span>
      </Panel>

      {error && <p className={page.error}>{error}</p>}

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>六科课程</h2>
          <p>未接入的学科继续显示真实状态</p>
        </div>
        <div className={styles.subjectGrid}>
          {curriculumCatalog.subjects.map((subject) => {
            const subjectCourses = courses.filter((course) => course.subject === subject.code);
            return (
              <Panel key={subject.code} className={styles.subjectCard}>
                <div className={styles.subjectHeader}>
                  <span className={page.iconChip}>
                    <Icon icon={subjectIcons[subject.code]} />
                  </span>
                  <span className={styles.status} data-status={subject.status}>
                    {courseStatusLabels[subject.status]}
                  </span>
                </div>
                <div className={styles.subjectCopy}>
                  <h3>{subject.name}</h3>
                  <p>{subject.scope}</p>
                </div>
                <div className={styles.subjectFooter}>
                  {subjectCourses.map((course) => (
                    <button key={course.slug} type="button" onClick={() => void start(course)}>
                      {course.title} · {progressLabels[course.progress.status]}
                      <Icon icon="lucide:arrow-right" />
                    </button>
                  ))}
                  {subject.memoryModules.map((kind) => (
                    <Link key={kind} to={memoryLinks[kind].href}>
                      {memoryLinks[kind].label}已可用
                      <Icon icon="lucide:arrow-right" />
                    </Link>
                  ))}
                  {subjectCourses.length === 0 && subject.memoryModules.length === 0 && (
                    <span>课程内容待建设</span>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      {pilot && (
        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>首个连续课程</h2>
            <p>高二物理 · 教学、测评与复测闭环</p>
          </div>
          <Panel className={styles.pilotCard}>
            <div className={styles.pilotIntro}>
              <span>{pilot.grade} · 物理</span>
              <h3>{pilot.title}</h3>
              <p>{pilot.summary}</p>
              <small>{pilot.statusDetail}</small>
              <div className={styles.courseAction}>
                <Button
                  variant="primary"
                  disabled={starting || pilot.progress.status === 'retest-scheduled'}
                  onClick={() => void start(pilot)}
                >
                  {starting ? '正在准备' : courseAction(pilot)}
                  {pilot.progress.status !== 'retest-scheduled' && (
                    <Icon icon="lucide:arrow-right" />
                  )}
                </Button>
                <span>{progressLabels[pilot.progress.status]}</span>
              </div>
            </div>
            <div className={styles.pilotDetails}>
              <div className={styles.courseProgress}>
                <span>学习进度</span>
                <Progress label="学习进度" value={pilot.progress.progressPercent} />
                <small>
                  {pilot.progress.completedSteps} / {pilot.progress.totalSteps} 步
                  {pilot.progress.assessmentTotal
                    ? ` · 独立测评 ${pilot.progress.assessmentCorrect}/${pilot.progress.assessmentTotal}`
                    : ''}
                </small>
                {pilot.progress.status === 'retest-scheduled' && pilot.progress.retestDueAt && (
                  <small>
                    复测开放时间：
                    {new Date(pilot.progress.retestDueAt).toLocaleDateString('zh-CN')}
                  </small>
                )}
              </div>
              <div>
                <span>课程目标</span>
                <ul>
                  {pilot.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span>课程流程</span>
                <ol className={styles.flow}>
                  {pilot.plannedFlow.map((step, index) => (
                    <li key={step}>
                      <small>{String(index + 1).padStart(2, '0')}</small>
                      <strong>{step}</strong>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Panel>
        </section>
      )}
    </div>
  );
}
