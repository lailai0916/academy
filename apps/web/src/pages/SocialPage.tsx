import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Avatar, Button, Panel, SelectField, TextAreaField, TextField } from '@lailai/ui';
import type { Challenge, SocialPost, StudyGroup } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './FeaturePages.module.css';

type SocialData = { feed: SocialPost[]; groups: StudyGroup[]; challenges: Challenge[] };
type Friendship = {
  person?: { id: string; username: string; displayName: string; grade: string };
  status: 'pending' | 'accepted';
  direction: 'incoming' | 'outgoing';
};
type SocialTab = 'feed' | 'groups' | 'friends';

const socialTabs: Array<[SocialTab, string]> = [
  ['feed', '动态'],
  ['groups', '学习小组'],
  ['friends', '好友'],
];

const metricDetails: Record<
  Challenge['metric'],
  { label: string; targetLabel: string; unit: string }
> = {
  review_count: { label: '完成项目', targetLabel: '项目目标', unit: '项' },
  mastery_gain: { label: '掌握提升', targetLabel: '提升目标', unit: '分' },
  delayed_accuracy: { label: '延迟正确率', targetLabel: '正确率目标', unit: '%' },
};

const reactionLabels = {
  support: ['lucide:heart', '支持'],
  insight: ['lucide:lightbulb', '有启发'],
  together: ['lucide:users', '一起学'],
} as const;

function ChallengeCard({
  challenge,
  busy,
  onJoin,
}: {
  challenge: Challenge;
  busy: boolean;
  onJoin: () => void;
}) {
  const metric = metricDetails[challenge.metric];
  const isAccuracy = challenge.metric === 'delayed_accuracy';
  const progressLabel = isAccuracy
    ? `${challenge.progressValue}${metric.unit} / ${challenge.targetValue}${metric.unit} · ${challenge.qualifyingEventCount}/${challenge.minimumSamples} 次延迟测试`
    : `${challenge.progressValue} / ${challenge.targetValue} ${metric.unit}`;
  const personalLabel = !challenge.joined
    ? null
    : isAccuracy
      ? challenge.personalEventCount > 0
        ? `你：${challenge.personalValue}% · ${challenge.personalEventCount} 次延迟测试`
        : '你还没有完成延迟测试'
      : `你贡献 ${challenge.personalValue} ${metric.unit}`;
  const statusLabel =
    challenge.status === 'completed'
      ? '已达成'
      : challenge.status === 'ended'
        ? '已结束'
        : '进行中';

  return (
    <Panel>
      <article className={styles.goalCard}>
        <header className={styles.goalCardHeader}>
          <div>
            <span>{challenge.groupName}</span>
            <h3>{challenge.title}</h3>
          </div>
          <span className={styles.goalStatus} data-status={challenge.status}>
            {statusLabel}
          </span>
        </header>
        <div className={styles.goalProgressCopy}>
          <strong>{metric.label}</strong>
          <span>{progressLabel}</span>
        </div>
        <div
          className={styles.goalProgress}
          role="progressbar"
          aria-label={`${challenge.title}完成进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={challenge.progressPercent}
        >
          <span style={{ width: `${challenge.progressPercent}%` }} />
        </div>
        <div className={styles.goalFooter}>
          <div className={styles.metaRow}>
            <span>
              <Icon icon="lucide:users" /> {challenge.participantCount} 人参与
            </span>
            <span>
              <Icon icon="lucide:calendar-days" />
              {new Date(challenge.endsAt).toLocaleDateString('zh-CN')} 截止
            </span>
            {personalLabel && <span>{personalLabel}</span>}
          </div>
          {!challenge.joined && challenge.status === 'active' && (
            <Button variant="secondary" size="small" disabled={busy} onClick={onJoin}>
              参与目标
            </Button>
          )}
        </div>
      </article>
    </Panel>
  );
}

export function SocialPage() {
  const [data, setData] = useState<SocialData | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [tab, setTab] = useState<SocialTab>('feed');
  const [post, setPost] = useState('');
  const [visibility, setVisibility] = useState<'platform' | 'friends'>('platform');
  const [friendUsername, setFriendUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [challengeGroupId, setChallengeGroupId] = useState('');
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeMetric, setChallengeMetric] = useState<Challenge['metric']>('review_count');
  const [challengeTarget, setChallengeTarget] = useState('30');
  const [challengeSamples, setChallengeSamples] = useState('20');
  const [challengeDays, setChallengeDays] = useState('7');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [social, friendshipData] = await Promise.all([
      api<SocialData>('/social'),
      api<{ friendships: Friendship[] }>('/social/friends'),
    ]);
    setData(social);
    setChallengeGroupId((current) =>
      social.groups.some((group) => group.id === current && group.joined)
        ? current
        : (social.groups.find((group) => group.joined)?.id ?? '')
    );
    setFriends(friendshipData.friendships);
  }, []);

  useEffect(() => {
    load().catch((nextError) => setError(errorMessage(nextError)));
  }, [load]);

  const run = async (action: () => Promise<void>, success?: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load();
      if (success) setMessage(success);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const createPost = (event: FormEvent) => {
    event.preventDefault();
    if (!post.trim()) return;
    void run(async () => {
      await api('/social/posts', {
        method: 'POST',
        body: JSON.stringify({ body: post, groupId: null, visibility }),
      });
      setPost('');
    });
  };

  const createGroup = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api('/social/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, description: groupDescription }),
      });
      setGroupName('');
      setGroupDescription('');
    }, '学习小组已创建。');
  };

  const createChallenge = (event: FormEvent) => {
    event.preventDefault();
    if (!challengeGroupId || !challengeTitle.trim()) return;
    void run(async () => {
      await api('/social/challenges', {
        method: 'POST',
        body: JSON.stringify({
          groupId: challengeGroupId,
          title: challengeTitle,
          metric: challengeMetric,
          targetValue: Number(challengeTarget),
          minimumSamples: Number(challengeSamples),
          days: Number(challengeDays),
        }),
      });
      setChallengeTitle('');
      setShowGoalForm(false);
    }, '共同目标已创建。');
  };

  const changeMetric = (metric: Challenge['metric']) => {
    setChallengeMetric(metric);
    setChallengeTarget(
      metric === 'delayed_accuracy' ? '80' : metric === 'mastery_gain' ? '50' : '30'
    );
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: SocialTab) => {
    const currentIndex = socialTabs.findIndex(([value]) => value === current);
    const targetIndex =
      event.key === 'ArrowRight'
        ? (currentIndex + 1) % socialTabs.length
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + socialTabs.length) % socialTabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? socialTabs.length - 1
              : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const nextTab = socialTabs[targetIndex]![0];
    setTab(nextTab);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-social-tab="${nextTab}"]`)
      ?.focus();
  };

  const joinedGroups = data?.groups.filter((group) => group.joined) ?? [];
  const currentChallenges =
    data?.challenges.filter((challenge) => challenge.status === 'active') ?? [];
  const pastChallenges =
    data?.challenges.filter((challenge) => challenge.status !== 'active') ?? [];

  if (!data && !error) return <div className={page.empty}>正在载入同学圈……</div>;

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <h1 className={page.pageHeading}>同学</h1>
      </header>

      <div className={styles.tabList} role="tablist" aria-label="同学圈栏目">
        {socialTabs.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`${styles.tab} ${tab === value ? styles.tabActive : ''}`}
            role="tab"
            id={`social-tab-${value}`}
            data-social-tab={value}
            aria-controls={`social-panel-${value}`}
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => handleTabKeyDown(event, value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className={page.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={page.success} aria-live="polite">
          {message}
        </p>
      )}

      {tab === 'feed' && (
        <div
          className={page.section}
          role="tabpanel"
          id="social-panel-feed"
          aria-labelledby="social-tab-feed"
        >
          <Panel feature>
            <form className={styles.composer} onSubmit={createPost}>
              <TextAreaField
                label="分享一条学习动态"
                value={post}
                maxLength={500}
                placeholder="分享学习方法或复习记录"
                onChange={(event) => setPost(event.target.value)}
              />
              <div className={styles.composerActions}>
                <SelectField
                  label="谁可以看到"
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as typeof visibility)}
                >
                  <option value="platform">全平台</option>
                  <option value="friends">仅好友</option>
                </SelectField>
                <Button type="submit" disabled={busy || !post.trim()}>
                  发布动态
                </Button>
              </div>
            </form>
          </Panel>
          <div className={styles.feed}>
            {data?.feed.length ? (
              data.feed.map((item) => (
                <Panel key={item.id}>
                  <article className={styles.post}>
                    <header className={styles.postHeader}>
                      <Avatar name={item.author.displayName} alt="" />
                      <div>
                        <strong>{item.author.displayName}</strong>
                        <span>
                          @{item.author.username} ·{' '}
                          {new Date(item.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      {item.group && <span>{item.group.name}</span>}
                    </header>
                    <p className={styles.postBody}>{item.body}</p>
                    <div className={styles.reactionRow}>
                      {(Object.keys(reactionLabels) as Array<keyof typeof reactionLabels>).map(
                        (kind) => (
                          <button
                            key={kind}
                            type="button"
                            aria-pressed={item.reacted.includes(kind)}
                            disabled={busy}
                            onClick={() =>
                              run(async () => {
                                await api(`/social/posts/${item.id}/reactions`, {
                                  method: 'POST',
                                  body: JSON.stringify({ kind }),
                                });
                              })
                            }
                          >
                            <Icon icon={reactionLabels[kind][0]} /> {reactionLabels[kind][1]}{' '}
                            {item.reactions[kind] || ''}
                          </button>
                        )
                      )}
                    </div>
                  </article>
                </Panel>
              ))
            ) : (
              <p className={page.empty}>暂无动态。</p>
            )}
          </div>
        </div>
      )}

      {tab === 'groups' && (
        <div
          className={page.section}
          role="tabpanel"
          id="social-panel-groups"
          aria-labelledby="social-tab-groups"
        >
          <Panel feature>
            <form className={styles.composer} onSubmit={createGroup}>
              <div className={page.formRow}>
                <TextField
                  label="小组名称"
                  value={groupName}
                  minLength={2}
                  maxLength={40}
                  onChange={(event) => setGroupName(event.target.value)}
                  required
                />
                <TextField
                  label="简介"
                  value={groupDescription}
                  maxLength={200}
                  onChange={(event) => setGroupDescription(event.target.value)}
                  required
                />
              </div>
              <div className={page.actions}>
                <Button type="submit" disabled={busy}>
                  创建学习小组
                </Button>
              </div>
            </form>
          </Panel>
          <div className={styles.cardGrid}>
            {data?.groups.length ? (
              data.groups.map((group) => (
                <Panel key={group.id}>
                  <article className={styles.card}>
                    <h3>{group.name}</h3>
                    <p>{group.description || '暂无简介。'}</p>
                    <div className={styles.metaRow}>
                      <span>{group.memberCount} 位成员</span>
                      <span>创建者 @{group.ownerUsername}</span>
                    </div>
                    {group.joined ? (
                      <span className={styles.groupMembership}>
                        <Icon icon="lucide:check" /> 已加入
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          run(() => api(`/social/groups/${group.id}/join`, { method: 'POST' }))
                        }
                      >
                        加入小组
                      </Button>
                    )}
                  </article>
                </Panel>
              ))
            ) : (
              <p className={page.empty}>还没有学习小组，可以先创建一个。</p>
            )}
          </div>
          <div className={styles.goalToolbar}>
            <div>
              <h2>共同目标</h2>
              <span>以小组整体进度为准，不设置成员排名。</span>
            </div>
            {joinedGroups.length > 0 && (
              <Button
                variant="secondary"
                size="small"
                aria-expanded={showGoalForm}
                aria-controls="create-group-goal"
                onClick={() => setShowGoalForm((current) => !current)}
              >
                <Icon icon={showGoalForm ? 'lucide:x' : 'lucide:plus'} />
                {showGoalForm ? '收起' : '创建目标'}
              </Button>
            )}
          </div>
          {showGoalForm && joinedGroups.length > 0 && (
            <Panel feature>
              <form id="create-group-goal" className={styles.goalForm} onSubmit={createChallenge}>
                <div className={styles.goalFormPrimary}>
                  <SelectField
                    label="学习小组"
                    value={challengeGroupId}
                    onChange={(event) => setChallengeGroupId(event.target.value)}
                  >
                    {joinedGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="目标名称"
                    value={challengeTitle}
                    minLength={2}
                    maxLength={80}
                    placeholder="例如：本周完成 30 项复习"
                    onChange={(event) => setChallengeTitle(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.goalFormMetrics}>
                  <SelectField
                    label="衡量方式"
                    value={challengeMetric}
                    onChange={(event) => changeMetric(event.target.value as Challenge['metric'])}
                  >
                    {Object.entries(metricDetails).map(([value, detail]) => (
                      <option key={value} value={value}>
                        {detail.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label={`${metricDetails[challengeMetric].targetLabel}（${metricDetails[challengeMetric].unit}）`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={challengeMetric === 'delayed_accuracy' ? 100 : 10_000}
                    value={challengeTarget}
                    onChange={(event) => setChallengeTarget(event.target.value)}
                    required
                  />
                  {challengeMetric === 'delayed_accuracy' && (
                    <TextField
                      label="最低测试次数"
                      type="number"
                      inputMode="numeric"
                      min={5}
                      max={1_000}
                      value={challengeSamples}
                      onChange={(event) => setChallengeSamples(event.target.value)}
                      required
                    />
                  )}
                  <TextField
                    label="持续天数"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={60}
                    value={challengeDays}
                    onChange={(event) => setChallengeDays(event.target.value)}
                    required
                  />
                </div>
                <div className={styles.goalFormFooter}>
                  <span>
                    {challengeMetric === 'delayed_accuracy'
                      ? '达到正确率且满足最低测试次数后，目标才算完成。'
                      : '进度只统计参与目标之后完成的有效学习记录。'}
                  </span>
                  <Button type="submit" disabled={busy || !challengeTitle.trim()}>
                    创建共同目标
                  </Button>
                </div>
              </form>
            </Panel>
          )}
          <div className={styles.goalList}>
            {currentChallenges.length ? (
              currentChallenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  busy={busy}
                  onJoin={() =>
                    void run(
                      () => api(`/social/challenges/${challenge.id}/join`, { method: 'POST' }),
                      '已参与共同目标。'
                    )
                  }
                />
              ))
            ) : (
              <p className={page.empty}>
                {joinedGroups.length
                  ? '当前没有进行中的共同目标。'
                  : '加入学习小组后，可以参与共同目标。'}
              </p>
            )}
          </div>
          {pastChallenges.length > 0 && (
            <details className={styles.goalHistory}>
              <summary>过往目标 · {pastChallenges.length}</summary>
              <div className={styles.goalList}>
                {pastChallenges.map((challenge) => (
                  <ChallengeCard
                    key={challenge.id}
                    challenge={challenge}
                    busy={busy}
                    onJoin={() => undefined}
                  />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'friends' && (
        <div
          className={page.section}
          role="tabpanel"
          id="social-panel-friends"
          aria-labelledby="social-tab-friends"
        >
          <Panel feature>
            <form
              className={styles.composer}
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  await api('/social/friends', {
                    method: 'POST',
                    body: JSON.stringify({ username: friendUsername }),
                  });
                  setFriendUsername('');
                }, '好友申请已发送。');
              }}
            >
              <TextField
                label="按用户名添加好友"
                value={friendUsername}
                placeholder="例如 lailai"
                onChange={(event) => setFriendUsername(event.target.value)}
                required
              />
              <div className={page.actions}>
                <Button type="submit" disabled={busy}>
                  发送申请
                </Button>
              </div>
            </form>
          </Panel>
          <Panel>
            <div className={page.panelBody}>
              {friends.length ? (
                <ul className={page.list}>
                  {friends.map((friend, index) => (
                    <li
                      className={page.listItem}
                      key={`${friend.person?.id ?? 'unknown'}-${index}`}
                    >
                      <Avatar name={friend.person?.displayName ?? '?'} alt="" />
                      <span className={page.listCopy}>
                        <strong>{friend.person?.displayName ?? '未知用户'}</strong>
                        <span>
                          @{friend.person?.username} ·{' '}
                          {friend.status === 'accepted'
                            ? '已是好友'
                            : friend.direction === 'incoming'
                              ? '等待你接受'
                              : '申请已发送'}
                        </span>
                      </span>
                      {friend.status === 'pending' &&
                        friend.direction === 'incoming' &&
                        friend.person && (
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() =>
                              run(() =>
                                api(`/social/friends/${friend.person!.id}/accept`, {
                                  method: 'POST',
                                })
                              )
                            }
                          >
                            接受
                          </Button>
                        )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={page.muted}>暂无好友或待处理申请。</p>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
