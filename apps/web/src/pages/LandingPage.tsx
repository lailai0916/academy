import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { PublicHeader } from '../components/PublicHeader';
import styles from './LandingPage.module.css';

const principles = [
  ['教材范围', '人教版 · 部编版'],
  ['首期内容', '英语词汇 · 古诗词'],
  ['学习指标', '掌握度 · 延迟正确率'],
] as const;

const steps = [
  ['01', '建立水平', '通过诊断和初次练习建立内容掌握记录。'],
  ['02', '安排计划', '先处理到期复习，再加入适量新内容。'],
  ['03', '调整题型', '从识别逐步进入拼写、语境、补空和接句。'],
  ['04', '延迟检验', '间隔后的正确结果单独计入长期记忆指标。'],
] as const;

export function LandingPage() {
  return (
    <div className={styles.page}>
      <PublicHeader />

      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1>按掌握情况安排每一次学习</h1>
            <p className={styles.intro}>
              围绕人教版高中教材，根据复习记录调整计划、题型和难度。当前提供英语词汇与古诗词学习。
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

          <div className={styles.productPreview} aria-label="Academy 学习界面预览">
            <div className={styles.previewHeader}>
              <div>
                <span>今日学习</span>
                <strong>8 月 25 日</strong>
              </div>
              <span className={styles.previewStatus}>4 / 16</span>
            </div>
            <div className={styles.previewProgress}>
              <span style={{ width: '25%' }} />
            </div>
            <div className={styles.previewSubjects}>
              <article>
                <span className={styles.previewIcon}>
                  <Icon icon="lucide:languages" />
                </span>
                <div>
                  <strong>英语词汇</strong>
                  <span>8 项复习 · 4 项新学</span>
                </div>
                <Icon icon="lucide:chevron-right" />
              </article>
              <article>
                <span className={styles.previewIcon}>
                  <Icon icon="lucide:feather" />
                </span>
                <div>
                  <strong>古诗词</strong>
                  <span>3 项复习 · 1 项新学</span>
                </div>
                <Icon icon="lucide:chevron-right" />
              </article>
            </div>
            <div className={styles.previewMetrics}>
              <div>
                <span>掌握度</span>
                <strong>78%</strong>
              </div>
              <div>
                <span>延迟正确率</span>
                <strong>86%</strong>
              </div>
              <div>
                <span>长期记忆</span>
                <strong>42</strong>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.principles} aria-label="平台范围">
          {principles.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className={styles.section} id="system">
          <header className={styles.sectionHeader}>
            <p>学习系统</p>
            <h2>计划来自学习记录</h2>
            <span>系统记录每个知识项目的复习间隔、答题结果和记忆稳定性。</span>
          </header>

          <div className={styles.systemGrid}>
            <article className={styles.systemPrimary}>
              <div className={styles.featureHeading}>
                <span className={styles.featureIcon}>
                  <Icon icon="lucide:list-checks" />
                </span>
                <div>
                  <span>每日计划</span>
                  <h3>先复习到期内容</h3>
                </div>
              </div>
              <div className={styles.schedule}>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <p>新内容不会挤占已经到期的复习。</p>
            </article>

            <article className={styles.systemCard}>
              <span className={styles.featureIcon}>
                <Icon icon="lucide:brain" />
              </span>
              <h3>自适应题型</h3>
              <p>掌握度提高后，题目从识别转向主动回忆和应用。</p>
            </article>

            <article className={styles.systemCard}>
              <span className={styles.featureIcon}>
                <Icon icon="lucide:target" />
              </span>
              <h3>结果指标</h3>
              <p>重点观察延迟测试与长期稳定性，不以使用时长排名。</p>
            </article>
          </div>
        </section>

        <section className={`${styles.section} ${styles.method}`} id="method">
          <header className={styles.sectionHeader}>
            <p>学习方法</p>
            <h2>从诊断到延迟检验</h2>
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

        <section className={`${styles.section} ${styles.community}`} id="community">
          <div className={styles.communityCopy}>
            <p className={styles.sectionLabel}>学习社区</p>
            <h2>交流方法，不比较在线时长</h2>
            <span>动态、好友、小组和挑战围绕实际学习结果展开。</span>
            <Link to="/login">
              登录后查看
              <Icon icon="lucide:arrow-right" />
            </Link>
          </div>
          <div className={styles.activityPreview}>
            <div className={styles.activityHeader}>
              <span className={styles.avatar}>L</span>
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
          </div>
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
        </nav>
      </footer>
    </div>
  );
}
