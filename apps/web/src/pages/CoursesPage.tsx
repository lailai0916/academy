import { Panel } from '@lailai0916/ui';
import { courseStatusLabels, curriculumCatalog } from '@lailai/academy-shared';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
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

export function CoursesPage() {
  const pilot = curriculumCatalog.courses[0];

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={styles.headingCopy}>
          <h1 className={page.pageHeading}>学科课程</h1>
          <p>课程教学与记忆训练分开建模，再由长期计划统一安排。</p>
        </div>
      </header>

      <Panel feature className={styles.milestone}>
        <span className={styles.milestoneIcon}>
          <Icon icon="lucide:route" />
        </span>
        <div>
          <span>下一阶段</span>
          <h2>{curriculumCatalog.nextMilestone}</h2>
          <p>当前页面先固定六科范围、课程状态和教学流程，尚未开放完整课堂。</p>
        </div>
        <span className={styles.status} data-status="building">
          架构接入中
        </span>
      </Panel>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>六科课程</h2>
          <p>状态按实际开发进度标记</p>
        </div>
        <div className={styles.subjectGrid}>
          {curriculumCatalog.subjects.map((subject) => (
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
                {subject.memoryModules.length > 0 ? (
                  subject.memoryModules.map((kind) => (
                    <Link key={kind} to={memoryLinks[kind].href}>
                      {memoryLinks[kind].label}已可用
                      <Icon icon="lucide:arrow-right" />
                    </Link>
                  ))
                ) : (
                  <span>课程内容待建设</span>
                )}
              </div>
            </Panel>
          ))}
        </div>
      </section>

      {pilot && (
        <section className={page.section}>
          <div className={page.sectionHeader}>
            <h2>首个课程样例</h2>
            <p>验证课程教学模块，不替代现有记忆训练</p>
          </div>
          <Panel className={styles.pilotCard}>
            <div className={styles.pilotIntro}>
              <span>{pilot.grade} · 物理</span>
              <h3>{pilot.title}</h3>
              <p>{pilot.summary}</p>
              <small>{pilot.statusDetail}</small>
            </div>
            <div className={styles.pilotDetails}>
              <div>
                <span>课程目标</span>
                <ul>
                  {pilot.objectives.map((objective) => (
                    <li key={objective}>{objective}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span>计划流程</span>
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
