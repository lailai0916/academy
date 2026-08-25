import { useEffect, useState } from 'react';
import { Avatar, Button, Panel } from '@lailai/ui';
import { useNavigate, useParams } from 'react-router';
import type { Profile } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './FeaturePages.module.css';

export function ProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ profile: Profile }>(username ? `/profile/${encodeURIComponent(username)}` : '/profile/me')
      .then((result) => setProfile(result.profile))
      .catch((nextError) => setError(errorMessage(nextError)));
  }, [username]);

  if (error) return <p className={page.error}>{error}</p>;
  if (!profile) return <div className={page.empty}>正在载入个人主页……</div>;

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>{username ? '同学' : '我的'}</p>
          <h1>个人主页</h1>
          <p>个人资料与学习结果。</p>
        </div>
      </header>

      <Panel feature>
        <div className={styles.profileHero}>
          <div className={styles.profileIdentity}>
            <Avatar name={profile.displayName} alt="个人头像" size={72} />
            <div>
              <strong>{profile.displayName}</strong>
              <span>
                @{profile.username} · {profile.grade}
              </span>
              <p className={styles.bio}>{profile.bio || '暂无个人简介。'}</p>
              <div className={styles.metaRow}>
                <span>
                  <Icon icon="lucide:calendar-days" />{' '}
                  {new Date(profile.createdAt).toLocaleDateString('zh-CN')} 加入
                </span>
                <span>
                  <Icon icon={profile.isPublic ? 'lucide:globe-2' : 'lucide:lock'} />{' '}
                  {profile.isPublic ? '公开主页' : '私密主页'}
                </span>
              </div>
            </div>
          </div>
          {!username && (
            <Button variant="secondary" onClick={() => navigate('/settings')}>
              <Icon icon="lucide:settings-2" /> 编辑资料
            </Button>
          )}
        </div>
      </Panel>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>学习结果</h2>
          <p>随着有效复习自动更新</p>
        </div>
        <div className={page.grid4}>
          <article className={page.metric}>
            <span>综合掌握度</span>
            <strong>{profile.mastery}%</strong>
            <small>全部已学内容</small>
          </article>
          <article className={page.metric}>
            <span>延迟测试正确率</span>
            <strong>{profile.delayedAccuracy}%</strong>
            <small>至少间隔 24 小时</small>
          </article>
          <article className={page.metric}>
            <span>累计有效复习</span>
            <strong>{profile.reviewCount}</strong>
            <small>次</small>
          </article>
          <article className={page.metric}>
            <span>考试目标</span>
            <strong>{profile.targetScore}</strong>
            <small>总分目标</small>
          </article>
        </div>
      </section>
    </div>
  );
}
