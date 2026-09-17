import { Link } from 'react-router';
import { Avatar, Panel } from '@lailai0916/ui';
import { Icon } from '../components/Icon';
import { PublicHeader } from '../components/PublicHeader';
import styles from './LandingPage.module.css';

const principles = [
  ['目标范围', '浙江高考六科'],
  ['当前可用', '英语词汇 · 古诗词'],
  ['正在接入', '物理 · 动量定理'],
] as const;

const steps = [
  ['01', '课前检查', '用少量问题确认前置知识，决定课程从哪里开始。'],
  ['02', '讲解追问', '按知识关系讲解，学生可以随时打断、追问和继续推导。'],
  ['03', '独立作答', '将教学中的提示撤掉，用新题检验是否真正会做。'],
  ['04', '延迟复测', '隔一段时间重新测试，把短期听懂与长期掌握区分开。'],
] as const;

const progress = [
  {
    status: '已实现',
    title: '记忆训练模块',
    description: '英语词汇与古诗词学习、间隔复习、错题巩固和长期记忆指标。',
  },
  {
    status: '接入中',
    title: '首个连续课程',
    description: '以高二物理“动量定理”为样例，接通讲解、追问、练习、测评和复测。',
  },
  {
    status: '规划中',
    title: '六科长期计划',
    description: '把课程、独立测评和记忆复习放进同一份每日与长期学习计划。',
  },
] as const;

export function LandingPage() {
  return (
    <div id="top" className={styles.page}>
      <PublicHeader />

      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>面向浙江高中生的 AI 自学平台</span>
            <h1>把六科课程、练习和长期复习接在一起</h1>
            <p className={styles.intro}>
              学生可以按自己的节奏听讲、追问、练习和复测。当前英语词汇与古诗词记忆模块已经可用，连续学科课程从高二物理开始接入。
            </p>
            <div className={styles.heroActions}>
              <Link to="/login" className={styles.primaryButton}>
                登录
                <Icon icon="lucide:arrow-right" />
              </Link>
              <Link to="/register" className={styles.secondaryButton}>
                使用邀请码注册
              </Link>
            </div>
          </div>

          <Panel
            feature
            className={styles.productPreview}
            role="group"
            aria-label="Academy 学习界面预览"
          >
            <div className={styles.previewHeader}>
              <div>
                <span>今日安排</span>
                <strong>课程与复习</strong>
              </div>
              <span className={styles.previewStatus}>前期版本</span>
            </div>
            <div
              className={styles.previewProgress}
              role="progressbar"
              aria-label="平台模块接入进度"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={1}
            >
              <span style={{ width: '33.333%' }} />
            </div>
            <div className={styles.previewSubjects}>
              <article>
                <span className={styles.previewIcon}>
                  <Icon icon="lucide:atom" />
                </span>
                <div>
                  <strong>物理 · 动量定理</strong>
                  <span>连续课程 · 正在接入</span>
                </div>
                <span className={styles.itemStatus}>接入中</span>
              </article>
              <article>
                <span className={styles.previewIcon}>
                  <Icon icon="lucide:rotate-ccw" />
                </span>
                <div>
                  <strong>词汇与古诗词复习</strong>
                  <span>间隔复习 · 已可学习</span>
                </div>
                <span className={styles.itemStatus}>已实现</span>
              </article>
            </div>
            <div className={styles.previewMetrics} role="group" aria-label="平台结构">
              <div>
                <span>学科范围</span>
                <strong>6 科</strong>
              </div>
              <div>
                <span>课程样例</span>
                <strong>1 个</strong>
              </div>
              <div>
                <span>可用模块</span>
                <strong>记忆</strong>
              </div>
            </div>
          </Panel>
        </section>

        <section className={styles.principles} aria-label="平台范围">
          {principles.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className={styles.section} id="architecture">
          <header className={styles.sectionHeader}>
            <p>平台结构</p>
            <h2>三类任务，各自解决一个问题</h2>
            <span>
              课程负责教会，测评负责确认，记忆训练负责长期保持；学习计划再把它们安排到一起。
            </span>
          </header>

          <div className={styles.systemGrid}>
            <article className={styles.systemPrimary}>
              <div className={styles.featureHeading}>
                <span className={styles.featureIcon}>
                  <Icon icon="lucide:messages-square" />
                </span>
                <div>
                  <span>课程教学</span>
                  <h3>讲解可以被随时打断</h3>
                </div>
              </div>
              <div className={styles.lessonFlow} aria-label="计划中的课程流程">
                <span>基础检查</span>
                <span>概念讲解</span>
                <span>学生追问</span>
                <span>分层练习</span>
                <span>独立测评</span>
              </div>
              <p>
                课程按知识关系组织。学生可以追问原因、补前置知识，也可以在已经理解时直接进入练习。
              </p>
            </article>

            <article className={styles.systemCard}>
              <span className={styles.featureIcon}>
                <Icon icon="lucide:clipboard-check" />
              </span>
              <h3>独立测评</h3>
              <p>撤掉讲解中的提示，用新题判断学生是否能够独立完成。</p>
            </article>

            <article className={styles.systemCard}>
              <span className={styles.featureIcon}>
                <Icon icon="lucide:calendar-range" />
              </span>
              <h3>长期计划</h3>
              <p>根据测评、错题和到期复习调整后续安排，持续检查长期掌握。</p>
            </article>
          </div>
        </section>

        <section className={`${styles.section} ${styles.method}`} id="method">
          <header className={styles.sectionHeader}>
            <p>学习方法</p>
            <h2>从听懂到能够长期独立作答</h2>
          </header>
          <ol className={styles.steps}>
            {steps.map(([index, title, description]) => (
              <li key={index}>
                <span>{index}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={`${styles.section} ${styles.progressSection}`} id="progress">
          <header className={styles.sectionHeader}>
            <p>建设进度</p>
            <h2>现有功能保留，新的课程系统逐步接入</h2>
            <span>这里展示真实进度。规划中的模块不会被写成已经完成的产品能力。</span>
          </header>
          <div className={styles.progressGrid}>
            {progress.map((item, index) => (
              <article key={item.title}>
                <div>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.status}</strong>
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.section} ${styles.community}`} id="community">
          <div className={styles.communityCopy}>
            <p className={styles.sectionLabel}>辅助模块</p>
            <h2>用同伴反馈帮助坚持</h2>
            <span>动态、好友、小组和挑战记录实际学习结果，为长期自学提供轻量监督。</span>
            <Link to="/login">
              登录后查看
              <Icon icon="lucide:arrow-right" />
            </Link>
          </div>
          <Panel className={styles.activityPreview}>
            <div className={styles.activityHeader}>
              <Avatar name="lailai" alt="lailai" size={40} />
              <div>
                <strong>学习动态</strong>
                <span>英语 · 词汇复习</span>
              </div>
            </div>
            <p>今天重新整理了 3 个容易混淆的词，延迟测试全部正确。</p>
            <div className={styles.activityActions}>
              <span>支持 12</span>
              <span>有启发 5</span>
              <span>一起学 3</span>
            </div>
          </Panel>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <span>lailai's Academy</span>
          <span>© 2026 lailai</span>
        </div>
        <nav aria-label="页脚导航">
          <Link to="/login">登录</Link>
          <Link to="/register">邀请码注册</Link>
          <a href="#top">返回顶部</a>
        </nav>
      </footer>
    </div>
  );
}
