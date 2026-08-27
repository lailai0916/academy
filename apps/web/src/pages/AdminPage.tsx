import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, Panel, SelectField, TextAreaField, TextField } from '@lailai/ui';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router';
import type {
  AdminContentItem,
  AdminSummary,
  AdminUser,
  AiSettings,
  ContentImportBatch,
  ContentImportPreview,
  ContentImportRequest,
  Invite,
} from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import feature from './FeaturePages.module.css';
import page from './Page.module.css';
import styles from './AdminPage.module.css';
import { AdminContentDetailPage } from './AdminContentDetailPage';

type AdminSection = 'overview' | 'content' | 'invites' | 'ai' | 'users';
type ContentStatus = AdminContentItem['status'];

const sections: { id: AdminSection; label: string; path: string }[] = [
  { id: 'overview', label: '概览', path: '/admin' },
  { id: 'content', label: '内容库', path: '/admin/content' },
  { id: 'invites', label: '邀请码', path: '/admin/invites' },
  { id: 'ai', label: 'AI 服务', path: '/admin/ai' },
  { id: 'users', label: '用户', path: '/admin/users' },
];

const emptySummary: AdminSummary = {
  users: 0,
  content: 0,
  invites: 0,
  imports: 0,
  published: 0,
  draft: 0,
  archived: 0,
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

const contentStatusLabels: Record<ContentStatus, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
};

function formatContentSource(source: string) {
  return source === 'manual' ? 'Academy 内置示例' : source;
}

function currentSection(pathname: string): AdminSection {
  const value = pathname.split('/')[2];
  return sections.some((section) => section.id === value) ? (value as AdminSection) : 'overview';
}

export function AdminPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const section = currentSection(location.pathname);
  const contentId = section === 'content' ? location.pathname.split('/')[3] : undefined;
  const [summary, setSummary] = useState<AdminSummary>(emptySummary);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [content, setContent] = useState<AdminContentItem[]>([]);
  const [contentTotal, setContentTotal] = useState(0);
  const [imports, setImports] = useState<ContentImportBatch[]>([]);
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
  const [importSource, setImportSource] = useState('人教版高中教材');
  const [importVersion, setImportVersion] = useState('');
  const [importStatus, setImportStatus] = useState<'draft' | 'published'>('draft');
  const [importJson, setImportJson] = useState(importExample);
  const [importPreview, setImportPreview] = useState<ContentImportPreview | null>(null);
  const [pendingImport, setPendingImport] = useState<ContentImportRequest | null>(null);
  const contentQuery = searchParams.get('q') ?? '';
  const contentKind = searchParams.get('kind') ?? '';
  const contentGrade = searchParams.get('grade') ?? '';
  const contentStatus = searchParams.get('status') ?? '';
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadBase = useCallback(async () => {
    const [summaryResult, userResult, inviteResult, aiResult, importResult] = await Promise.all([
      api<{ summary: AdminSummary }>('/admin/summary'),
      api<{ users: AdminUser[] }>('/admin/users'),
      api<{ invites: Invite[] }>('/admin/invites'),
      api<{ settings: AiSettings }>('/admin/ai'),
      api<{ imports: ContentImportBatch[] }>('/admin/content/imports'),
    ]);
    setSummary(summaryResult.summary);
    setUsers(userResult.users);
    setInvites(inviteResult.invites);
    setAi(aiResult.settings);
    setImports(importResult.imports);
  }, []);

  const loadContent = useCallback(async () => {
    const query = new URLSearchParams({ limit: '100' });
    if (contentQuery.trim()) query.set('q', contentQuery.trim());
    if (contentKind) query.set('kind', contentKind);
    if (contentGrade) query.set('grade', contentGrade);
    if (contentStatus) query.set('status', contentStatus);
    const result = await api<{ content: AdminContentItem[]; total: number }>(
      `/admin/content?${query}`
    );
    setContent(result.content);
    setContentTotal(result.total);
  }, [contentGrade, contentKind, contentQuery, contentStatus]);

  useEffect(() => {
    loadBase().catch((nextError) => setError(errorMessage(nextError)));
  }, [loadBase]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadContent().catch((nextError) => setError(errorMessage(nextError)));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [loadContent]);

  useEffect(() => {
    setError('');
    setMessage('');
  }, [location.pathname]);

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

  const refreshAdmin = async () => {
    await Promise.all([loadBase(), loadContent()]);
  };

  const invalidatePreview = () => {
    setImportPreview(null);
    setPendingImport(null);
  };

  const updateContentFilter = (key: 'q' | 'kind' | 'grade' | 'status', value: string) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  };

  const createInvite = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      const result = await api<{ invite: Invite }>('/admin/invites', {
        method: 'POST',
        body: JSON.stringify({ label: inviteLabel, maxUses, expiresInDays }),
      });
      setNewInvite(result.invite.code ?? '');
      await loadBase();
      return '邀请码已生成。明文仅显示这一次。';
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
        return 'AI 服务连接正常。';
      }
      const result = await api<{ settings: AiSettings }>('/admin/ai', { method: 'PUT', body });
      setAi(result.settings);
      setApiKey('');
      return 'AI 配置已加密保存。';
    });

  const parseImport = (): ContentImportRequest => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      throw new Error('JSON 格式不正确。请修正后重新检查。');
    }
    const items = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && 'items' in parsed
        ? (parsed as { items: unknown }).items
        : null;
    if (!Array.isArray(items)) {
      throw new Error('JSON 中缺少 items 数组。');
    }
    return {
      source: importSource,
      version: importVersion,
      status: importStatus,
      items: items as ContentImportRequest['items'],
    };
  };

  const previewImport = () =>
    run(async () => {
      const input = parseImport();
      const result = await api<{ preview: ContentImportPreview }>('/admin/content/import/preview', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setPendingImport(input);
      setImportPreview(result.preview);
      return '预检完成，请核对变更后确认导入。';
    });

  const applyImport = () =>
    run(async () => {
      if (!pendingImport || !importPreview) return;
      const result = await api<{ batch: ContentImportBatch }>('/admin/content/import', {
        method: 'POST',
        body: JSON.stringify({ ...pendingImport, fingerprint: importPreview.fingerprint }),
      });
      invalidatePreview();
      await refreshAdmin();
      return `导入完成：新增 ${result.batch.createdCount} 项，更新 ${result.batch.updatedCount} 项。`;
    });

  const readImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('文件不能超过 5 MB。');
      event.target.value = '';
      return;
    }
    setImportJson(await file.text());
    invalidatePreview();
    setMessage(`已读取 ${file.name}。`);
    event.target.value = '';
  };

  return (
    <div className={page.page}>
      <header className={page.pageHeader}>
        <h1 className={page.pageHeading}>管理</h1>
      </header>

      <nav className={styles.sectionNav} aria-label="管理分区">
        {sections.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end={item.id === 'overview'}
            className={({ isActive }) =>
              `${styles.sectionLink} ${isActive ? styles.sectionLinkActive : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {error && <p className={page.error}>{error}</p>}
      {message && (
        <p className={page.success} role="status">
          {message}
        </p>
      )}

      {section === 'overview' && <AdminOverview summary={summary} />}

      {section === 'content' && contentId && (
        <AdminContentDetailPage contentId={contentId} onUpdated={refreshAdmin} />
      )}

      {section === 'content' && !contentId && (
        <AdminContent
          busy={busy}
          content={content}
          contentGrade={contentGrade}
          contentKind={contentKind}
          contentQuery={contentQuery}
          contentStatus={contentStatus}
          contentTotal={contentTotal}
          importJson={importJson}
          importPreview={importPreview}
          importSource={importSource}
          importStatus={importStatus}
          importVersion={importVersion}
          imports={imports}
          onApplyImport={applyImport}
          contentSearch={searchParams.toString()}
          onChangeContentGrade={(value) => updateContentFilter('grade', value)}
          onChangeContentKind={(value) => updateContentFilter('kind', value)}
          onChangeContentQuery={(value) => updateContentFilter('q', value)}
          onChangeContentStatus={(value) => updateContentFilter('status', value)}
          onChangeImportJson={(value) => {
            setImportJson(value);
            invalidatePreview();
          }}
          onChangeImportSource={(value) => {
            setImportSource(value);
            invalidatePreview();
          }}
          onChangeImportStatus={(value) => {
            setImportStatus(value);
            invalidatePreview();
          }}
          onChangeImportVersion={(value) => {
            setImportVersion(value);
            invalidatePreview();
          }}
          onInvalidatePreview={invalidatePreview}
          onPreviewImport={previewImport}
          onReadImportFile={readImportFile}
          onRollbackImport={(importId) =>
            run(async () => {
              const result = await api<{ batch: ContentImportBatch }>(
                `/admin/content/imports/${importId}/rollback`,
                { method: 'POST', body: JSON.stringify({ note: '管理员从导入记录执行回滚' }) }
              );
              await refreshAdmin();
              return `回滚完成：恢复 ${result.batch.rollbackRevertedCount} 项，跳过 ${result.batch.rollbackSkippedCount} 项。`;
            })
          }
          onToggleStatus={(item) =>
            run(async () => {
              const status = item.status === 'published' ? 'archived' : 'published';
              await api(`/admin/content/${item.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({
                  status,
                  expectedUpdatedAt: item.updatedAt,
                  note: status === 'published' ? '从内容库快速发布' : '从内容库快速归档',
                }),
              });
              await refreshAdmin();
              return status === 'published' ? '内容已发布。' : '内容已归档。';
            })
          }
        />
      )}

      {section === 'invites' && (
        <AdminInvites
          busy={busy}
          expiresInDays={expiresInDays}
          inviteLabel={inviteLabel}
          invites={invites}
          maxUses={maxUses}
          newInvite={newInvite}
          onChangeExpiresInDays={setExpiresInDays}
          onChangeInviteLabel={setInviteLabel}
          onChangeMaxUses={setMaxUses}
          onCopyInvite={() =>
            run(async () => {
              await navigator.clipboard.writeText(newInvite);
              return '邀请码已复制。';
            })
          }
          onCreateInvite={createInvite}
          onRevokeInvite={(inviteId) =>
            run(async () => {
              await api(`/admin/invites/${inviteId}`, { method: 'DELETE' });
              await loadBase();
              return '邀请码已撤销。';
            })
          }
        />
      )}

      {section === 'ai' && (
        <AdminAi
          ai={ai}
          apiKey={apiKey}
          busy={busy}
          onChangeAi={setAi}
          onChangeApiKey={setApiKey}
          onSave={() => saveAi(false)}
          onTest={() => saveAi(true)}
        />
      )}

      {section === 'users' && <AdminUsers users={users} />}
    </div>
  );
}

function AdminOverview({ summary }: { summary: AdminSummary }) {
  return (
    <>
      <div className={page.grid4}>
        <article className={page.metric}>
          <span>用户</span>
          <strong>{summary.users}</strong>
          <small>含管理员</small>
        </article>
        <article className={page.metric}>
          <span>已发布内容</span>
          <strong>{summary.published}</strong>
          <small>共 {summary.content} 项</small>
        </article>
        <article className={page.metric}>
          <span>待审草稿</span>
          <strong>{summary.draft}</strong>
          <small>{summary.archived} 项已归档</small>
        </article>
        <article className={page.metric}>
          <span>导入批次</span>
          <strong>{summary.imports}</strong>
          <small>记录来源与版本</small>
        </article>
      </div>
      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>管理入口</h2>
          <p>按工作对象分区</p>
        </div>
        <div className={styles.entryGrid}>
          {sections.slice(1).map((item) => (
            <NavLink key={item.id} to={item.path} className={styles.entry}>
              <span>
                <strong>{item.label}</strong>
                <small>
                  {item.id === 'content'
                    ? '预检、导入和发布教材内容'
                    : item.id === 'invites'
                      ? '生成和撤销注册邀请码'
                      : item.id === 'ai'
                        ? '配置模型与连接状态'
                        : '查看账号年级与状态'}
                </small>
              </span>
              <Icon icon="lucide:chevron-right" />
            </NavLink>
          ))}
        </div>
      </section>
    </>
  );
}

type AdminContentProps = {
  busy: boolean;
  content: AdminContentItem[];
  contentGrade: string;
  contentKind: string;
  contentQuery: string;
  contentStatus: string;
  contentSearch: string;
  contentTotal: number;
  importJson: string;
  importPreview: ContentImportPreview | null;
  importSource: string;
  importStatus: 'draft' | 'published';
  importVersion: string;
  imports: ContentImportBatch[];
  onApplyImport: () => void;
  onChangeContentGrade: (value: string) => void;
  onChangeContentKind: (value: string) => void;
  onChangeContentQuery: (value: string) => void;
  onChangeContentStatus: (value: string) => void;
  onChangeImportJson: (value: string) => void;
  onChangeImportSource: (value: string) => void;
  onChangeImportStatus: (value: 'draft' | 'published') => void;
  onChangeImportVersion: (value: string) => void;
  onInvalidatePreview: () => void;
  onPreviewImport: () => void;
  onReadImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onRollbackImport: (importId: string) => void;
  onToggleStatus: (item: AdminContentItem) => void;
};

function AdminContent(props: AdminContentProps) {
  const [rollbackCandidate, setRollbackCandidate] = useState<string | null>(null);
  const [statusCandidate, setStatusCandidate] = useState<string | null>(null);
  return (
    <>
      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>内容库</h2>
          <p>显示 {props.contentTotal} 项结果</p>
        </div>
        <Panel>
          <div className={styles.filters}>
            <TextField
              label="搜索"
              type="search"
              value={props.contentQuery}
              placeholder="内容、教材或单元"
              onChange={(event) => props.onChangeContentQuery(event.target.value)}
            />
            <SelectField
              label="类型"
              value={props.contentKind}
              onChange={(event) => props.onChangeContentKind(event.target.value)}
            >
              <option value="">全部</option>
              <option value="word">单词</option>
              <option value="poem">古诗词</option>
            </SelectField>
            <SelectField
              label="年级"
              value={props.contentGrade}
              onChange={(event) => props.onChangeContentGrade(event.target.value)}
            >
              <option value="">全部</option>
              <option value="高一">高一</option>
              <option value="高二">高二</option>
              <option value="高三">高三</option>
            </SelectField>
            <SelectField
              label="状态"
              value={props.contentStatus}
              onChange={(event) => props.onChangeContentStatus(event.target.value)}
            >
              <option value="">全部</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </SelectField>
          </div>
          <div className={`${feature.adminSection} ${feature.tableWrap}`}>
            <table className={feature.table}>
              <thead>
                <tr>
                  <th>内容</th>
                  <th>教材单元</th>
                  <th>来源</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {props.content.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className={styles.contentLink}
                        to={`/admin/content/${item.id}${props.contentSearch ? `?${props.contentSearch}` : ''}`}
                      >
                        {item.title}
                      </Link>{' '}
                      <span className={page.muted}>
                        {item.kind === 'word' ? '单词' : '古诗词'} · {item.grade} · v
                        {item.versionNumber}
                      </span>
                      {item.issueCount > 0 && (
                        <span className={styles.issueCount}>{item.issueCount} 项待完善</span>
                      )}
                    </td>
                    <td>
                      {item.textbook}
                      <br />
                      <span className={page.muted}>{item.unit}</span>
                    </td>
                    <td>
                      {formatContentSource(item.source)}
                      {item.sourceVersion && (
                        <span className={page.muted}> · {item.sourceVersion}</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.status} data-status={item.status}>
                        {contentStatusLabels[item.status]}
                      </span>
                      {item.status === 'draft' && item.hasPublishedVersion && (
                        <span className={styles.liveVersion}>线上版本保留</span>
                      )}
                    </td>
                    <td>
                      {statusCandidate === item.id ? (
                        <span className={styles.inlineConfirm}>
                          <span>{item.status === 'published' ? '确认归档？' : '确认发布？'}</span>
                          <Button
                            size="small"
                            variant={item.status === 'published' ? 'danger' : 'primary'}
                            disabled={props.busy}
                            onClick={() => {
                              props.onToggleStatus(item);
                              setStatusCandidate(null);
                            }}
                          >
                            确认
                          </Button>
                          <Button
                            size="small"
                            variant="quiet"
                            disabled={props.busy}
                            onClick={() => setStatusCandidate(null)}
                          >
                            取消
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="small"
                          variant="quiet"
                          disabled={props.busy}
                          onClick={() => setStatusCandidate(item.id)}
                        >
                          {item.status === 'published' ? '归档' : '发布'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.content.length === 0 && <p className={styles.emptyTable}>没有匹配的内容。</p>}
          </div>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>教材内容导入</h2>
          <p>单次最多 500 项</p>
        </div>
        <Panel feature>
          <div className={styles.importWorkspace}>
            <div className={page.formRow}>
              <TextField
                label="内容来源"
                value={props.importSource}
                onChange={(event) => props.onChangeImportSource(event.target.value)}
                required
              />
              <TextField
                label="版本或版次"
                value={props.importVersion}
                placeholder="例如 2019 版"
                onChange={(event) => props.onChangeImportVersion(event.target.value)}
              />
            </div>
            <SelectField
              label="导入状态"
              value={props.importStatus}
              description="草稿不会进入学生学习计划。确认内容无误后再发布。"
              onChange={(event) =>
                props.onChangeImportStatus(event.target.value as 'draft' | 'published')
              }
            >
              <option value="draft">保存为草稿</option>
              <option value="published">直接发布</option>
            </SelectField>
            <TextAreaField
              className={feature.jsonArea}
              label="内容 JSON"
              value={props.importJson}
              spellCheck={false}
              onChange={(event) => props.onChangeImportJson(event.target.value)}
              description="接受包含 items 数组的 JSON，也可直接粘贴项目数组。"
            />
            <div className={styles.importActions}>
              <label className={styles.fileButton}>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={props.onReadImportFile}
                />
                <Icon icon="lucide:upload" />
                选择 JSON 文件
              </label>
              <Button variant="secondary" disabled={props.busy} onClick={props.onPreviewImport}>
                检查内容
              </Button>
            </div>

            {props.importPreview && (
              <ImportPreview
                busy={props.busy}
                preview={props.importPreview}
                status={props.importStatus}
                onApply={props.onApplyImport}
                onCancel={props.onInvalidatePreview}
              />
            )}
          </div>
        </Panel>
      </section>

      <section className={page.section}>
        <div className={page.sectionHeader}>
          <h2>导入记录</h2>
          <p>最近 {props.imports.length} 个批次</p>
        </div>
        <Panel>
          <div className={`${feature.adminSection} ${feature.tableWrap}`}>
            <table className={feature.table}>
              <thead>
                <tr>
                  <th>来源</th>
                  <th>导入结果</th>
                  <th>状态</th>
                  <th>时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {props.imports.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.source}
                      {item.version && <span className={page.muted}> · {item.version}</span>}
                    </td>
                    <td>
                      新增 {item.createdCount} · 更新 {item.updatedCount} · 无变化{' '}
                      {item.unchangedCount}
                    </td>
                    <td>
                      {item.rolledBackAt ? (
                        <span className={styles.status}>已回滚</span>
                      ) : (
                        contentStatusLabels[item.status]
                      )}
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                    <td>
                      {item.rolledBackAt ? (
                        <span className={page.muted}>
                          恢复 {item.rollbackRevertedCount} · 跳过 {item.rollbackSkippedCount}
                        </span>
                      ) : rollbackCandidate === item.id ? (
                        <span className={styles.inlineConfirm}>
                          <span>恢复到导入前？</span>
                          <Button
                            size="small"
                            variant="danger"
                            disabled={props.busy}
                            onClick={() => {
                              props.onRollbackImport(item.id);
                              setRollbackCandidate(null);
                            }}
                          >
                            确认回滚
                          </Button>
                          <Button
                            size="small"
                            variant="quiet"
                            disabled={props.busy}
                            onClick={() => setRollbackCandidate(null)}
                          >
                            取消
                          </Button>
                        </span>
                      ) : (
                        <Button
                          size="small"
                          variant="quiet"
                          disabled={props.busy}
                          onClick={() => setRollbackCandidate(item.id)}
                        >
                          回滚
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {props.imports.length === 0 && <p className={styles.emptyTable}>还没有导入记录。</p>}
          </div>
        </Panel>
      </section>
    </>
  );
}

function ImportPreview({
  busy,
  preview,
  status,
  onApply,
  onCancel,
}: {
  busy: boolean;
  preview: ContentImportPreview;
  status: 'draft' | 'published';
  onApply: () => void;
  onCancel: () => void;
}) {
  const publicationBlocked = status === 'published' && preview.issues.length > 0;
  return (
    <div className={styles.preview} aria-live="polite">
      <div className={styles.previewHeader}>
        <div>
          <p>导入预检</p>
          <h3>{preview.total} 项内容</h3>
        </div>
        <span>{status === 'draft' ? '保存为草稿' : '导入后发布'}</span>
      </div>
      <div className={styles.previewMetrics}>
        <span>
          <strong>{preview.created}</strong> 新增
        </span>
        <span>
          <strong>{preview.updated}</strong> 更新
        </span>
        <span>
          <strong>{preview.unchanged}</strong> 无变化
        </span>
        <span>
          <strong>{preview.units}</strong> 教材单元
        </span>
      </div>
      <p className={styles.previewDetail}>
        单词 {preview.words} 项 · 古诗词 {preview.poems} 项 · 高一 {preview.grades.高一} 项 · 高二{' '}
        {preview.grades.高二} 项 · 高三 {preview.grades.高三} 项
      </p>
      {preview.issues.length > 0 && (
        <div className={styles.qualityIssues}>
          <strong>
            发现 {preview.issues.length} 项内容完整性
            {publicationBlocked ? '问题，修正前不能发布' : '提示'}
          </strong>
          <ul>
            {preview.issues.slice(0, 6).map((issue) => (
              <li key={`${issue.key}-${issue.field}`}>
                <code>{issue.key}</code>：{issue.message}
              </li>
            ))}
          </ul>
          {preview.issues.length > 6 && <p>另有 {preview.issues.length - 6} 项未展开。</p>}
        </div>
      )}
      <div className={page.actions}>
        <Button disabled={busy || publicationBlocked} onClick={onApply}>
          {publicationBlocked ? '修正后发布' : '确认导入'}
        </Button>
        <Button variant="quiet" disabled={busy} onClick={onCancel}>
          返回修改
        </Button>
      </div>
    </div>
  );
}

type AdminInvitesProps = {
  busy: boolean;
  expiresInDays: number;
  inviteLabel: string;
  invites: Invite[];
  maxUses: number;
  newInvite: string;
  onChangeExpiresInDays: (value: number) => void;
  onChangeInviteLabel: (value: string) => void;
  onChangeMaxUses: (value: number) => void;
  onCopyInvite: () => void;
  onCreateInvite: (event: FormEvent) => void;
  onRevokeInvite: (inviteId: string) => void;
};

function AdminInvites(props: AdminInvitesProps) {
  return (
    <section className={page.section}>
      <div className={page.sectionHeader}>
        <h2>邀请码</h2>
        <p>数据库仅保存邀请码哈希</p>
      </div>
      <div className={styles.twoColumns}>
        <Panel feature>
          <form className={feature.adminSection} onSubmit={props.onCreateInvite}>
            <TextField
              label="用途标签"
              value={props.inviteLabel}
              onChange={(event) => props.onChangeInviteLabel(event.target.value)}
              required
            />
            <div className={page.formRow}>
              <TextField
                label="可使用次数"
                type="number"
                min={1}
                max={100}
                value={props.maxUses}
                onChange={(event) => props.onChangeMaxUses(Number(event.target.value))}
              />
              <TextField
                label="有效天数"
                type="number"
                min={1}
                max={365}
                value={props.expiresInDays}
                onChange={(event) => props.onChangeExpiresInDays(Number(event.target.value))}
              />
            </div>
            <Button type="submit" disabled={props.busy}>
              生成邀请码
            </Button>
            {props.newInvite && (
              <div className={styles.inviteResult}>
                <p>新邀请码</p>
                <code>{props.newInvite}</code>
                <Button size="small" variant="secondary" onClick={props.onCopyInvite}>
                  复制邀请码
                </Button>
              </div>
            )}
          </form>
        </Panel>
        <Panel>
          <div className={`${feature.adminSection} ${feature.tableWrap}`}>
            <table className={feature.table}>
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
                {props.invites.map((invite) => (
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
                          disabled={props.busy}
                          onClick={() => props.onRevokeInvite(invite.id)}
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
      </div>
    </section>
  );
}

function AdminAi({
  ai,
  apiKey,
  busy,
  onChangeAi,
  onChangeApiKey,
  onSave,
  onTest,
}: {
  ai: AiSettings;
  apiKey: string;
  busy: boolean;
  onChangeAi: (value: AiSettings) => void;
  onChangeApiKey: (value: string) => void;
  onSave: () => void;
  onTest: () => void;
}) {
  return (
    <section className={page.section}>
      <div className={page.sectionHeader}>
        <h2>AI 服务</h2>
        <p>{ai.hasApiKey ? 'API Key 已配置' : 'API Key 尚未配置'}</p>
      </div>
      <Panel feature>
        <div className={styles.settingsForm}>
          <div className={page.formRow}>
            <TextField
              label="服务商名称"
              value={ai.provider}
              onChange={(event) => onChangeAi({ ...ai, provider: event.target.value })}
            />
            <TextField
              label="模型"
              value={ai.model}
              onChange={(event) => onChangeAi({ ...ai, model: event.target.value })}
            />
          </div>
          <TextField
            label="OpenAI 兼容 Base URL"
            type="url"
            value={ai.baseUrl}
            onChange={(event) => onChangeAi({ ...ai, baseUrl: event.target.value })}
          />
          <TextField
            label="API Key"
            type="password"
            value={apiKey}
            autoComplete="off"
            placeholder={ai.hasApiKey ? '留空则保留现有密钥' : '输入 API Key'}
            onChange={(event) => onChangeApiKey(event.target.value)}
          />
          <div className={page.actions}>
            <Button disabled={busy} onClick={onSave}>
              保存配置
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onTest}>
              测试连接
            </Button>
          </div>
          {ai.updatedAt && (
            <p className={page.muted}>上次更新：{new Date(ai.updatedAt).toLocaleString('zh-CN')}</p>
          )}
        </div>
      </Panel>
    </section>
  );
}

function AdminUsers({ users }: { users: AdminUser[] }) {
  return (
    <section className={page.section}>
      <div className={page.sectionHeader}>
        <h2>用户</h2>
        <p>最近 {users.length} 个账号</p>
      </div>
      <Panel>
        <div className={`${feature.adminSection} ${feature.tableWrap}`}>
          <table className={feature.table}>
            <thead>
              <tr>
                <th>用户</th>
                <th>年级</th>
                <th>角色</th>
                <th>状态</th>
                <th>最近登录</th>
                <th>注册时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.displayName}</strong>{' '}
                    <span className={page.muted}>@{user.username}</span>
                  </td>
                  <td>{user.grade}</td>
                  <td>{user.role === 'admin' ? '管理员' : '学生'}</td>
                  <td>{user.status === 'active' ? '正常' : '已停用'}</td>
                  <td>
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString('zh-CN')
                      : '尚未登录'}
                  </td>
                  <td>{new Date(user.createdAt).toLocaleDateString('zh-CN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
