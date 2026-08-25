import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Panel, TextAreaField, TextField } from '@lailai/ui';
import type { AdminContentItem, AiSettings, Invite } from '@lailai/academy-shared';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './FeaturePages.module.css';

type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  status: string;
  grade: string;
  createdAt: string;
  lastLoginAt: string | null;
};

const importExample = `{
  "items": [
    {
      "key": "word-example",
      "kind": "word",
      "grade": "高一",
      "textbook": "人教版普通高中英语",
      "unit": "必修第一册 · Unit 1",
      "tags": ["高频"],
      "payload": {
        "headword": "example",
        "phonetic": "/ɪɡˈzɑːmpl/",
        "meanings": ["例子"],
        "example": "This is an example.",
        "exampleTranslation": "这是一个例子。",
        "aliases": []
      }
    }
  ]
}`;

export function AdminPage() {
  const [summary, setSummary] = useState({ users: 0, content: 0, invites: 0 });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [ai, setAi] = useState<AiSettings>({
    provider: 'OpenAI Compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6-sol',
    hasApiKey: false,
    updatedAt: null,
  });
  const [apiKey, setApiKey] = useState('');
  const [inviteLabel, setInviteLabel] = useState('首批内测');
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [newInvite, setNewInvite] = useState('');
  const [importJson, setImportJson] = useState(importExample);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [summaryResult, userResult, inviteResult, aiResult, contentResult] = await Promise.all([
      api<{ summary: typeof summary }>('/admin/summary'),
      api<{ users: AdminUser[] }>('/admin/users'),
      api<{ invites: Invite[] }>('/admin/invites'),
      api<{ settings: AiSettings }>('/admin/ai'),
      api<{ content: AdminContentItem[] }>('/admin/content'),
    ]);
    setSummary(summaryResult.summary);
    setUsers(userResult.users);
    setInvites(inviteResult.invites);
    setAi(aiResult.settings);
    setContent(contentResult.content);
  }, []);

  useEffect(() => {
    load().catch((nextError) => setError(errorMessage(nextError)));
  }, [load]);

  const run = async (action: () => Promise<string | void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const nextMessage = await action();
      if (nextMessage) setMessage(nextMessage);
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  const createInvite = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await api<{ invite: Invite }>('/admin/invites', {
        method: 'POST',
        body: JSON.stringify({ label: inviteLabel, maxUses, expiresInDays }),
      });
      setNewInvite(result.invite.code ?? '');
      await load();
      return '邀请码已生成。明文只会显示这一次，请立即保存。';
    });
  };

  const saveAi = (testOnly = false) =>
    run(async () => {
      const body = JSON.stringify({
        provider: ai.provider,
        baseUrl: ai.baseUrl,
        model: ai.model,
        ...(apiKey ? { apiKey } : {}),
      });
      if (testOnly) {
        await api('/admin/ai/test', { method: 'POST', body });
        return 'AI 服务连接测试成功。';
      }
      const result = await api<{ settings: AiSettings }>('/admin/ai', { method: 'PUT', body });
      setAi(result.settings);
      setApiKey('');
      return 'AI 配置已加密保存。';
    });

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <div className={page.pageTitle}>
          <p className={page.eyebrow}>管理员</p>
          <h1>管理</h1>
          <p>邀请码、AI 服务、教材内容与用户。</p>
        </div>
      </header>
      {error && <p className={page.error}>{error}</p>}
      {message && <p className={page.success}>{message}</p>}
      <div className={page.grid3}>
        <article className={page.metric}>
          <span>用户</span>
          <strong>{summary.users}</strong>
          <small>含管理员</small>
        </article>
        <article className={page.metric}>
          <span>教材内容</span>
          <strong>{summary.content}</strong>
          <small>单词与古诗词</small>
        </article>
        <article className={page.metric}>
          <span>邀请码</span>
          <strong>{summary.invites}</strong>
          <small>历史生成总数</small>
        </article>
      </div>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>邀请码</h2>
          <p>数据库只保存邀请码哈希</p>
        </div>
        <Panel feature>
          <form className={styles.adminSection} onSubmit={createInvite}>
            <div className={page.formRow}>
              <TextField
                label="用途标签"
                value={inviteLabel}
                onChange={(event) => setInviteLabel(event.target.value)}
                required
              />
              <TextField
                label="可使用次数"
                type="number"
                min={1}
                max={100}
                value={maxUses}
                onChange={(event) => setMaxUses(Number(event.target.value))}
              />
            </div>
            <TextField
              label="有效天数"
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(Number(event.target.value))}
            />
            <div className={page.actions}>
              <Button type="submit" disabled={busy}>
                生成邀请码
              </Button>
            </div>
            {newInvite && (
              <div>
                <p className={page.muted}>请立即复制：</p>
                <div className={styles.code}>{newInvite}</div>
              </div>
            )}
          </form>
        </Panel>
        <Panel>
          <div className={`${styles.adminSection} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>标签</th>
                  <th>使用情况</th>
                  <th>到期</th>
                  <th>状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.label}</td>
                    <td>
                      {invite.uses}/{invite.maxUses}
                    </td>
                    <td>{new Date(invite.expiresAt).toLocaleDateString('zh-CN')}</td>
                    <td>{invite.revoked ? '已撤销' : '有效'}</td>
                    <td>
                      {!invite.revoked && (
                        <Button
                          size="small"
                          variant="quiet"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api(`/admin/invites/${invite.id}`, { method: 'DELETE' });
                              await load();
                              return '邀请码已撤销。';
                            })
                          }
                        >
                          撤销
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>内容库</h2>
          <p>最近更新的 {content.length} 项</p>
        </div>
        <Panel>
          <div className={`${styles.adminSection} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>内容</th>
                  <th>教材单元</th>
                  <th>年级</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {content.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.title}{' '}
                      <span className={page.muted}>{item.kind === 'word' ? '单词' : '古诗词'}</span>
                    </td>
                    <td>{item.unit}</td>
                    <td>{item.grade}</td>
                    <td>
                      {item.status === 'published'
                        ? '已发布'
                        : item.status === 'draft'
                          ? '草稿'
                          : '已归档'}
                    </td>
                    <td>
                      <Button
                        size="small"
                        variant="quiet"
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            const status = item.status === 'published' ? 'archived' : 'published';
                            await api(`/admin/content/${item.id}/status`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status }),
                            });
                            await load();
                            return status === 'published' ? '内容已发布。' : '内容已归档。';
                          })
                        }
                      >
                        {item.status === 'published' ? '归档' : '发布'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>AI 服务</h2>
          <p>{ai.hasApiKey ? '已配置 API Key' : '尚未配置 API Key'}</p>
        </div>
        <Panel feature>
          <div className={styles.adminSection}>
            <div className={page.formRow}>
              <TextField
                label="服务商名称"
                value={ai.provider}
                onChange={(event) => setAi({ ...ai, provider: event.target.value })}
              />
              <TextField
                label="模型"
                value={ai.model}
                onChange={(event) => setAi({ ...ai, model: event.target.value })}
              />
            </div>
            <TextField
              label="OpenAI 兼容 Base URL"
              type="url"
              value={ai.baseUrl}
              onChange={(event) => setAi({ ...ai, baseUrl: event.target.value })}
            />
            <TextField
              label="API Key"
              type="password"
              value={apiKey}
              autoComplete="off"
              placeholder={ai.hasApiKey ? '留空则保留现有密钥' : '输入 API Key'}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <div className={page.actions}>
              <Button disabled={busy} onClick={() => saveAi(false)}>
                保存配置
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => saveAi(true)}>
                测试连接
              </Button>
            </div>
          </div>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>教材内容导入</h2>
          <p>单次最多 500 项，按 key 更新</p>
        </div>
        <Panel>
          <div className={styles.adminSection}>
            <TextAreaField
              className={styles.jsonArea}
              label="内容 JSON"
              value={importJson}
              spellCheck={false}
              onChange={(event) => setImportJson(event.target.value)}
              description="当前接受结构化的单词或古诗词项目。建议批次导入并保留原始数据文件。"
            />
            <div className={page.actions}>
              <Button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    let body: unknown;
                    try {
                      body = JSON.parse(importJson);
                    } catch {
                      throw new Error('JSON 格式不正确。');
                    }
                    const result = await api<{ imported: number }>('/admin/content/import', {
                      method: 'POST',
                      body: JSON.stringify(body),
                    });
                    await load();
                    return `已导入 ${result.imported} 项内容。`;
                  })
                }
              >
                验证并导入
              </Button>
            </div>
          </div>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>用户</h2>
          <p>最近 200 个账号</p>
        </div>
        <Panel>
          <div className={`${styles.adminSection} ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>用户</th>
                  <th>年级</th>
                  <th>角色</th>
                  <th>状态</th>
                  <th>注册时间</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      {user.displayName} <span className={page.muted}>@{user.username}</span>
                    </td>
                    <td>{user.grade}</td>
                    <td>{user.role}</td>
                    <td>{user.status}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </div>
  );
}
