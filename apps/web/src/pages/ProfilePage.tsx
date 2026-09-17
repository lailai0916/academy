import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Avatar, Button, EmptyState, Panel, SelectField, TextAreaField } from '@lailai0916/ui';
import { useNavigate, useParams } from 'react-router';
import type { ProfileRelationship, ProfileView, SocialPost } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './ProfilePage.module.css';

type ProfileTab = 'overview' | 'posts' | 'activity';

const tabs: Array<{ id: ProfileTab; label: string }> = [
  { id: 'overview', label: '主页' },
  { id: 'posts', label: '动态' },
  { id: 'activity', label: '学习记录' },
];

const reactionDetails = {
  support: { icon: 'lucide:heart', label: '支持' },
  insight: { icon: 'lucide:lightbulb', label: '有启发' },
  together: { icon: 'lucide:users', label: '一起学' },
} as const;

const activityIcons: Record<
  string,
  'lucide:book-open-check' | 'lucide:languages' | 'lucide:feather'
> = {
  'course-completed': 'lucide:book-open-check',
  'course-retest-completed': 'lucide:book-open-check',
  word_session: 'lucide:languages',
  poem_session: 'lucide:feather',
};

const relationshipLabels: Record<Exclude<ProfileRelationship, 'self'>, string> = {
  none: '添加好友',
  'pending-incoming': '接受申请',
  'pending-outgoing': '申请已发送',
  friends: '已是好友',
};

function relativeTime(value: string) {
  const date = new Date(value);
  const delta = date.getTime() - Date.now();
  const minutes = Math.round(delta / 60_000);
  if (Math.abs(minutes) < 1) return '刚刚';
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat('zh-CN').format(minutes, 'minute');
  const hours = Math.round(delta / 3_600_000);
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat('zh-CN').format(hours, 'hour');
  const days = Math.round(delta / 86_400_000);
  if (Math.abs(days) < 14) return new Intl.RelativeTimeFormat('zh-CN').format(days, 'day');
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function PostCard({
  post,
  busy,
  onReact,
}: {
  post: SocialPost;
  busy: boolean;
  onReact: (kind: keyof typeof reactionDetails) => void;
}) {
  return (
    <Panel>
      <article className={styles.post}>
        <header className={styles.postHeader}>
          <Avatar name={post.author.displayName} alt="" size={44} />
          <div className={styles.postAuthor}>
            <strong>{post.author.displayName}</strong>
            <span>
              @{post.author.username} ·{' '}
              <time dateTime={post.createdAt}>{relativeTime(post.createdAt)}</time>
            </span>
          </div>
          <span className={styles.visibilityLabel}>
            <Icon icon={post.visibility === 'platform' ? 'lucide:globe-2' : 'lucide:lock'} />
            {post.group?.name ?? (post.visibility === 'platform' ? '全站可见' : '好友可见')}
          </span>
        </header>
        <p className={styles.postBody}>{post.body}</p>
        <footer className={styles.reactionRow} aria-label="动态互动">
          {(Object.keys(reactionDetails) as Array<keyof typeof reactionDetails>).map((kind) => {
            const detail = reactionDetails[kind];
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={post.reacted.includes(kind)}
                aria-label={`${detail.label}${post.reactions[kind] > 0 ? `，${post.reactions[kind]} 人` : ''}`}
                disabled={busy}
                onClick={() => onReact(kind)}
              >
                <Icon icon={detail.icon} />
                <span>{detail.label}</span>
                {post.reactions[kind] > 0 && <strong>{post.reactions[kind]}</strong>}
              </button>
            );
          })}
        </footer>
      </article>
    </Panel>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { username } = useParams();
  const [data, setData] = useState<ProfileView | null>(null);
  const [tab, setTab] = useState<ProfileTab>('overview');
  const [post, setPost] = useState('');
  const [visibility, setVisibility] = useState<'platform' | 'friends'>('platform');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const result = await api<ProfileView>(
        username ? `/profile/${encodeURIComponent(username)}` : '/profile/me'
      );
      setData(result);
    } catch (nextError) {
      setError(errorMessage(nextError));
    }
  }, [username]);

  useEffect(() => {
    setData(null);
    setTab('overview');
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      if (success) setMessage(success);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy('');
    }
  };

  if (!data) {
    return (
      <div className={styles.loadingState} role={error ? 'alert' : 'status'}>
        <span className={styles.loadingAvatar} aria-hidden="true">
          <Icon icon={error ? 'lucide:cloud-alert' : 'lucide:user-round'} />
        </span>
        <strong>{error ? '暂时无法打开个人主页' : '正在载入个人主页'}</strong>
        <p>{error || '正在整理个人资料、学习结果和公开动态。'}</p>
        {error && (
          <Button variant="secondary" onClick={() => void load()}>
            重新加载
          </Button>
        )}
      </div>
    );
  }

  const { profile } = data;
  const isSelf = data.relationship === 'self';
  const metricCards = [
    {
      label: '综合掌握度',
      value: `${profile.mastery}%`,
      detail: '稳定性与可回忆概率',
      icon: 'lucide:brain' as const,
    },
    {
      label: '延迟正确率',
      value: `${profile.delayedAccuracy}%`,
      detail: '间隔至少 24 小时',
      icon: 'lucide:clock-3' as const,
    },
    {
      label: '长期记忆',
      value: String(profile.longTermCards),
      detail: '稳定期达到 21 天',
      icon: 'lucide:badge-check' as const,
    },
    {
      label: '完成课程',
      value: String(profile.completedCourses),
      detail: '含独立测评的课程',
      icon: 'lucide:graduation-cap' as const,
    },
  ];
  const relationshipDisabled = ['pending-outgoing', 'friends'].includes(data.relationship);

  const changeRelationship = () => {
    if (data.relationship === 'none') {
      void run(
        'relationship',
        () =>
          api('/social/friends', {
            method: 'POST',
            body: JSON.stringify({ username: profile.username }),
          }),
        '好友申请已发送。'
      );
    } else if (data.relationship === 'pending-incoming') {
      void run(
        'relationship',
        () => api(`/social/friends/${profile.id}/accept`, { method: 'POST' }),
        '你们现在是好友了。'
      );
    }
  };

  const createPost = (event: FormEvent) => {
    event.preventDefault();
    if (!post.trim()) return;
    void run(
      'create-post',
      async () => {
        await api('/social/posts', {
          method: 'POST',
          body: JSON.stringify({ body: post.trim(), groupId: null, visibility }),
        });
        setPost('');
      },
      '学习动态已发布。'
    );
  };

  const reactToPost = (postId: string, kind: keyof typeof reactionDetails) => {
    void run(`reaction:${postId}:${kind}`, () =>
      api(`/social/posts/${postId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ kind }),
      })
    );
  };

  const renderPosts = (posts: SocialPost[]) =>
    posts.length > 0 ? (
      <div className={styles.feed}>
        {posts.map((item) => (
          <PostCard
            key={item.id}
            post={item}
            busy={Boolean(busy)}
            onReact={(kind) => reactToPost(item.id, kind)}
          />
        ))}
      </div>
    ) : (
      <EmptyState
        title="还没有可见动态"
        description={
          isSelf ? '记录一次学习进展，让个人主页从这里开始。' : '对方还没有发布公开动态。'
        }
        icon={<Icon icon="lucide:messages-square" />}
      />
    );

  return (
    <div className={styles.page}>
      <section className={styles.profileHeader} aria-labelledby="profile-name">
        <div className={styles.cover} aria-hidden="true">
          <span>ACADEMY</span>
          <small>LEARN · VERIFY · RETAIN</small>
        </div>
        <div className={styles.identityArea}>
          <div className={styles.avatarFrame}>
            <Avatar name={profile.displayName} alt={`${profile.displayName}的头像`} size={104} />
          </div>
          <div className={styles.identityCopy}>
            <div className={styles.nameRow}>
              <h1 id="profile-name">{profile.displayName}</h1>
              {profile.role === 'admin' && (
                <span className={styles.verified} title="Academy 管理员">
                  <Icon icon="lucide:badge-check" />
                  <span>管理员</span>
                </span>
              )}
            </div>
            <span className={styles.handle}>@{profile.username}</span>
            <p className={styles.bio}>{profile.bio || '这个人还没有填写个人简介。'}</p>
            <div className={styles.metaRow}>
              <span>
                <Icon icon="lucide:graduation-cap" />
                {profile.grade}
              </span>
              <span>
                <Icon icon="lucide:calendar-days" />
                {new Date(profile.createdAt).toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                })}{' '}
                加入
              </span>
              <span>
                <Icon icon={profile.isPublic ? 'lucide:globe-2' : 'lucide:lock'} />
                {profile.isPublic ? '公开主页' : '仅好友可见'}
              </span>
            </div>
          </div>
          <div className={styles.profileActions}>
            {isSelf ? (
              <Button variant="secondary" onClick={() => navigate('/settings')}>
                <Icon icon="lucide:settings-2" />
                编辑资料
              </Button>
            ) : (
              <Button
                variant={data.relationship === 'pending-incoming' ? 'primary' : 'secondary'}
                disabled={Boolean(busy) || relationshipDisabled}
                onClick={changeRelationship}
              >
                <Icon
                  icon={
                    data.relationship === 'none'
                      ? 'lucide:user-plus'
                      : data.relationship === 'pending-incoming'
                        ? 'lucide:user-check'
                        : 'lucide:check'
                  }
                />
                {busy === 'relationship'
                  ? '正在处理'
                  : relationshipLabels[data.relationship as Exclude<ProfileRelationship, 'self'>]}
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate('/social')}>
              <Icon icon="lucide:users" />
              社区
            </Button>
          </div>
        </div>
        <div className={styles.socialStats} aria-label="社区数据">
          <button type="button" onClick={() => navigate('/social')}>
            <strong>{data.stats.friends}</strong>
            <span>好友</span>
          </button>
          <button type="button" onClick={() => setTab('posts')}>
            <strong>{data.stats.posts}</strong>
            <span>动态</span>
          </button>
          <button type="button" onClick={() => navigate('/social')}>
            <strong>{data.stats.groups}</strong>
            <span>学习小组</span>
          </button>
          <div>
            <strong>{profile.streakDays}</strong>
            <span>连续学习天数</span>
          </div>
        </div>
        <nav className={styles.tabs} role="tablist" aria-label="个人主页内容">
          {tabs.map((item) => (
            <button
              key={item.id}
              id={`profile-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`profile-panel-${item.id}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </section>

      {(error || message) && (
        <p className={error ? page.error : page.success} role={error ? 'alert' : 'status'}>
          {error || message}
        </p>
      )}

      <div className={styles.contentGrid}>
        <main className={styles.primaryColumn}>
          {tab === 'overview' && (
            <div
              className={styles.tabPanel}
              role="tabpanel"
              id="profile-panel-overview"
              aria-labelledby="profile-tab-overview"
            >
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span>学习画像</span>
                    <h2>用长期结果记录进步</h2>
                  </div>
                  <button type="button" onClick={() => setTab('activity')}>
                    查看学习记录 <Icon icon="lucide:arrow-right" />
                  </button>
                </div>
                <div className={styles.metricGrid}>
                  {metricCards.map((metric) => (
                    <article key={metric.label} className={styles.metricCard}>
                      <span className={styles.metricIcon}>
                        <Icon icon={metric.icon} />
                      </span>
                      <div>
                        <small>{metric.label}</small>
                        <strong>{metric.value}</strong>
                        <span>{metric.detail}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div>
                    <span>最近发布</span>
                    <h2>学习动态</h2>
                  </div>
                  {data.posts.length > 2 && (
                    <button type="button" onClick={() => setTab('posts')}>
                      查看全部 <Icon icon="lucide:arrow-right" />
                    </button>
                  )}
                </div>
                {renderPosts(data.posts.slice(0, 2))}
              </section>
            </div>
          )}

          {tab === 'posts' && (
            <div
              className={styles.tabPanel}
              role="tabpanel"
              id="profile-panel-posts"
              aria-labelledby="profile-tab-posts"
            >
              {isSelf && (
                <Panel feature>
                  <form className={styles.composer} onSubmit={createPost}>
                    <div className={styles.composerHeader}>
                      <Avatar name={profile.displayName} alt="" size={44} />
                      <div>
                        <strong>分享学习进展</strong>
                        <span>记录完成的任务、遇到的问题或下一步计划。</span>
                      </div>
                    </div>
                    <TextAreaField
                      label="动态内容"
                      value={post}
                      maxLength={500}
                      placeholder="今天学到了什么？"
                      onChange={(event) => setPost(event.target.value)}
                      required
                    />
                    <div className={styles.composerActions}>
                      <SelectField
                        label="可见范围"
                        value={visibility}
                        onChange={(event) =>
                          setVisibility(event.target.value as 'platform' | 'friends')
                        }
                      >
                        <option value="platform">全站可见</option>
                        <option value="friends">仅好友</option>
                      </SelectField>
                      <div className={styles.publishAction}>
                        <span>{post.length} / 500</span>
                        <Button
                          variant="primary"
                          type="submit"
                          disabled={Boolean(busy) || !post.trim()}
                        >
                          <Icon icon="lucide:send" />
                          {busy === 'create-post' ? '正在发布' : '发布动态'}
                        </Button>
                      </div>
                    </div>
                  </form>
                </Panel>
              )}
              {renderPosts(data.posts)}
            </div>
          )}

          {tab === 'activity' && (
            <div
              className={styles.tabPanel}
              role="tabpanel"
              id="profile-panel-activity"
              aria-labelledby="profile-tab-activity"
            >
              <Panel>
                <div className={styles.activityPanel}>
                  <header>
                    <div>
                      <span>学习轨迹</span>
                      <h2>最近完成</h2>
                    </div>
                    <strong>{profile.reviewCount} 次有效复习</strong>
                  </header>
                  {data.recentActivity.length > 0 ? (
                    <ol className={styles.timeline}>
                      {data.recentActivity.map((activity) => (
                        <li key={activity.id}>
                          <span className={styles.timelineIcon}>
                            <Icon icon={activityIcons[activity.kind] ?? 'lucide:book-open-check'} />
                          </span>
                          <div>
                            <strong>{activity.summary}</strong>
                            <time dateTime={activity.createdAt}>
                              {relativeTime(activity.createdAt)}
                            </time>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <EmptyState
                      title="还没有学习记录"
                      description="完成课程或记忆训练后，结果会出现在这里。"
                      icon={<Icon icon="lucide:history" />}
                    />
                  )}
                </div>
              </Panel>
            </div>
          )}
        </main>

        <aside className={styles.sidebar} aria-label="个人资料补充信息">
          <Panel>
            <section className={styles.sideSection}>
              <header>
                <span className={styles.sideIcon}>
                  <Icon icon="lucide:target" />
                </span>
                <div>
                  <span>学习目标</span>
                  <h2>当前计划</h2>
                </div>
              </header>
              <div className={styles.goalItem}>
                <div>
                  <span>高考目标</span>
                  <strong>{profile.targetScore} / 750</strong>
                </div>
                <div className={styles.goalTrack} aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (profile.targetScore / 750) * 100)}%` }} />
                </div>
              </div>
              <div className={styles.goalItem}>
                <div>
                  <span>每日记忆目标</span>
                  <strong>{profile.dailyGoal} 项</strong>
                </div>
                <p>到期内容优先，再按容量安排新内容。</p>
              </div>
            </section>
          </Panel>

          <Panel>
            <section className={styles.sideSection}>
              <header>
                <span className={styles.sideIcon}>
                  <Icon icon="lucide:users" />
                </span>
                <div>
                  <span>共同学习</span>
                  <h2>学习小组</h2>
                </div>
              </header>
              {data.groups.length > 0 ? (
                <ul className={styles.groupList}>
                  {data.groups.map((group) => (
                    <li key={group.id}>
                      <span>{group.name.slice(0, 1)}</span>
                      <div>
                        <strong>{group.name}</strong>
                        <small>
                          {group.memberCount} 位成员 · @{group.ownerUsername}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.sideEmpty}>还没有加入学习小组。</p>
              )}
              <Button variant="ghost" size="sm" onClick={() => navigate('/social')}>
                浏览学习小组 <Icon icon="lucide:arrow-right" />
              </Button>
            </section>
          </Panel>

          <Panel>
            <section className={styles.sideSection}>
              <header>
                <span className={styles.sideIcon}>
                  <Icon icon="lucide:user-round" />
                </span>
                <div>
                  <span>关于</span>
                  <h2>{profile.displayName}</h2>
                </div>
              </header>
              <dl className={styles.aboutList}>
                <div>
                  <dt>当前年级</dt>
                  <dd>{profile.grade}</dd>
                </div>
                <div>
                  <dt>主页状态</dt>
                  <dd>{profile.isPublic ? '公开' : '仅好友'}</dd>
                </div>
                <div>
                  <dt>累计复习</dt>
                  <dd>{profile.reviewCount} 次</dd>
                </div>
              </dl>
            </section>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
