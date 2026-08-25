import { useCallback, useEffect, useState, type FormEvent } from 'react';
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

const reactionLabels = {
  support: ['lucide:heart', '支持'],
  insight: ['lucide:lightbulb', '有启发'],
  together: ['lucide:users', '一起学'],
} as const;

export function SocialPage() {
  const [data, setData] = useState<SocialData | null>(null);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [tab, setTab] = useState<'feed' | 'groups' | 'friends'>('feed');
  const [post, setPost] = useState('');
  const [visibility, setVisibility] = useState<'platform' | 'friends'>('platform');
  const [friendUsername, setFriendUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [social, friendshipData] = await Promise.all([
      api<SocialData>('/social'),
      api<{ friendships: Friendship[] }>('/social/friends'),
    ]);
    setData(social);
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

  if (!data && !error) return <div className={page.empty}>正在载入同学圈……</div>;

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>同学圈</p>
          <h1>和认真学习的人互相推动。</h1>
          <p>分享方法、加入小组和发起挑战。这里只比较真实学习结果，不制造使用时长焦虑。</p>
        </div>
      </header>

      <div className={styles.tabList} role="tablist" aria-label="同学圈栏目">
        {(
          [
            ['feed', '动态'],
            ['groups', '学习小组与挑战'],
            ['friends', '好友'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`${styles.tab} ${tab === value ? styles.tabActive : ''}`}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className={page.error}>{error}</p>}
      {message && <p className={page.success}>{message}</p>}

      {tab === 'feed' && (
        <>
          <Panel feature>
            <form className={styles.composer} onSubmit={createPost}>
              <TextAreaField
                label="分享一条学习动态"
                value={post}
                maxLength={500}
                placeholder="例如：今天用语境联想记住了 responsible，分享一下你的方法……"
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
              <p className={page.empty}>还没有动态。你可以发布第一条学习心得。</p>
            )}
          </div>
        </>
      )}

      {tab === 'groups' && (
        <div className={page.section}>
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
            {data?.groups.map((group) => (
              <Panel key={group.id}>
                <article className={styles.card}>
                  <h3>{group.name}</h3>
                  <p>{group.description || '这个小组还没有简介。'}</p>
                  <div className={styles.metaRow}>
                    <span>{group.memberCount} 位成员</span>
                    <span>创建者 @{group.ownerUsername}</span>
                  </div>
                  <Button
                    variant="secondary"
                    disabled={busy || group.joined}
                    onClick={() =>
                      run(() => api(`/social/groups/${group.id}/join`, { method: 'POST' }))
                    }
                  >
                    {group.joined ? '已加入' : '加入小组'}
                  </Button>
                </article>
              </Panel>
            ))}
          </div>
          <div className={page.sectionHeader}>
            <h2>正在进行的挑战</h2>
          </div>
          <div className={styles.cardGrid}>
            {data?.challenges.length ? (
              data.challenges.map((challenge) => (
                <Panel key={challenge.id}>
                  <article className={styles.card}>
                    <h3>{challenge.title}</h3>
                    <p>
                      目标 {challenge.targetValue} · 截止{' '}
                      {new Date(challenge.endsAt).toLocaleDateString('zh-CN')}
                    </p>
                    <div className={styles.metaRow}>
                      <span>{challenge.participantCount} 人参与</span>
                    </div>
                    <Button
                      variant="secondary"
                      disabled={busy || challenge.joined}
                      onClick={() =>
                        run(() =>
                          api(`/social/challenges/${challenge.id}/join`, { method: 'POST' })
                        )
                      }
                    >
                      {challenge.joined ? '已参与' : '参与挑战'}
                    </Button>
                  </article>
                </Panel>
              ))
            ) : (
              <p className={page.empty}>还没有挑战。挑战创建接口已就绪，可由小组成员发起。</p>
            )}
          </div>
        </div>
      )}

      {tab === 'friends' && (
        <div className={page.section}>
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
                <p className={page.muted}>暂时没有好友或待处理申请。</p>
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
