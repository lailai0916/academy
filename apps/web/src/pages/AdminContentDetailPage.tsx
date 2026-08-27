import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Button, Panel, SelectField, TextAreaField, TextField } from '@lailai/ui';
import { Link, useLocation } from 'react-router';
import type { AdminContentDetail, PoemPayload, WordPayload } from '@lailai/academy-shared';
import { Icon } from '../components/Icon';
import { api, errorMessage } from '../lib/api';
import page from './Page.module.css';
import styles from './AdminPage.module.css';

type EditorState = {
  grade: '高一' | '高二' | '高三';
  textbook: string;
  unit: string;
  tags: string;
  source: string;
  version: string;
  status: 'draft' | 'published' | 'archived';
  note: string;
  headword: string;
  phonetic: string;
  meanings: string;
  example: string;
  exampleTranslation: string;
  aliases: string;
  title: string;
  author: string;
  dynasty: string;
  lines: string;
  translation: string;
  notes: string;
  keyPoints: string;
};

function toEditorState(content: AdminContentDetail): EditorState {
  const common = {
    grade: content.grade,
    textbook: content.textbook,
    unit: content.unit,
    tags: '',
    source: content.source,
    version: content.sourceVersion,
    status: content.status,
    note: '',
  };
  if (content.kind === 'word') {
    const payload = content.payload as WordPayload;
    return {
      ...common,
      tags: content.tags.join('，'),
      headword: payload.headword,
      phonetic: payload.phonetic,
      meanings: payload.meanings.join('\n'),
      example: payload.example,
      exampleTranslation: payload.exampleTranslation,
      aliases: payload.aliases.join('\n'),
      title: '',
      author: '',
      dynasty: '',
      lines: '',
      translation: '',
      notes: '',
      keyPoints: '',
    };
  }
  const payload = content.payload as PoemPayload;
  return {
    ...common,
    tags: content.tags.join('，'),
    headword: '',
    phonetic: '',
    meanings: '',
    example: '',
    exampleTranslation: '',
    aliases: '',
    title: payload.title,
    author: payload.author,
    dynasty: payload.dynasty,
    lines: payload.lines.join('\n'),
    translation: payload.translation,
    notes: payload.notes.join('\n'),
    keyPoints: payload.keyPoints.join('\n'),
  };
}

function lines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function tags(value: string) {
  return value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const changeLabels: Record<AdminContentDetail['revisions'][number]['changeKind'], string> = {
  imported: '批量导入',
  edited: '编辑',
  published: '发布',
  archived: '归档',
  restored: '回滚恢复',
  seeded: '系统初始化',
};

export function AdminContentDetailPage({
  contentId,
  onUpdated,
}: {
  contentId: string;
  onUpdated: () => Promise<void>;
}) {
  const location = useLocation();
  const [content, setContent] = useState<AdminContentDetail | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ content: AdminContentDetail }>(`/admin/content/${contentId}`);
      setContent(result.content);
      setEditor(toEditorState(result.content));
      setError('');
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, [contentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <Key extends keyof EditorState>(key: Key, value: EditorState[Key]) => {
    setEditor((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!content || !editor || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    const payload =
      content.kind === 'word'
        ? {
            headword: editor.headword,
            phonetic: editor.phonetic,
            meanings: lines(editor.meanings),
            example: editor.example,
            exampleTranslation: editor.exampleTranslation,
            aliases: lines(editor.aliases),
          }
        : {
            title: editor.title,
            author: editor.author,
            dynasty: editor.dynasty,
            lines: lines(editor.lines),
            translation: editor.translation,
            notes: lines(editor.notes),
            keyPoints: lines(editor.keyPoints),
          };
    try {
      const result = await api<{ content: AdminContentDetail; resetCards: number }>(
        `/admin/content/${contentId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            kind: content.kind,
            grade: editor.grade,
            textbook: editor.textbook,
            unit: editor.unit,
            tags: tags(editor.tags),
            source: editor.source,
            version: editor.version,
            status: editor.status,
            expectedUpdatedAt: content.updatedAt,
            note: editor.note,
            payload,
          }),
        }
      );
      setContent(result.content);
      setEditor(toEditorState(result.content));
      setMessage(
        result.resetCards > 0
          ? `内容已保存；因答案发生变化，已重置 ${result.resetCards} 张学习卡。`
          : '内容已保存并记录新版本。'
      );
      await onUpdated();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Panel className={styles.detailLoading}>正在读取内容…</Panel>;
  if (!content || !editor) {
    return (
      <Panel className={styles.detailLoading}>
        <p>{error || '教材内容不存在。'}</p>
        <Link to={`/admin/content${location.search}`}>返回内容库</Link>
      </Panel>
    );
  }

  return (
    <section className={styles.contentDetail}>
      <div className={styles.detailHeader}>
        <Link className={styles.backLink} to={`/admin/content${location.search}`}>
          <Icon icon="lucide:arrow-left" />
          返回内容库
        </Link>
        <div>
          <span>
            {content.kind === 'word' ? '英语单词' : '古诗词'} · {content.key} · v
            {content.versionNumber}
          </span>
          <h2>{content.title}</h2>
        </div>
      </div>

      {error && <p className={page.error}>{error}</p>}
      {message && (
        <p className={page.success} role="status">
          {message}
        </p>
      )}

      <form className={styles.detailLayout} onSubmit={save}>
        <Panel feature>
          <div className={styles.editorForm}>
            <div className={styles.editorSectionHeader}>
              <div>
                <h3>内容编辑</h3>
                <p>保存会创建不可变修订记录，不覆盖历史版本。</p>
              </div>
              <span className={styles.status} data-status={editor.status}>
                {editor.status === 'draft'
                  ? '草稿'
                  : editor.status === 'published'
                    ? '已发布'
                    : '已归档'}
              </span>
            </div>

            <div className={page.formRow}>
              <SelectField
                label="年级"
                value={editor.grade}
                onChange={(event) => update('grade', event.target.value as EditorState['grade'])}
              >
                <option value="高一">高一</option>
                <option value="高二">高二</option>
                <option value="高三">高三</option>
              </SelectField>
              <SelectField
                label="状态"
                value={editor.status}
                description="草稿和归档内容不会进入学生学习计划。"
                onChange={(event) => update('status', event.target.value as EditorState['status'])}
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="archived">归档</option>
              </SelectField>
            </div>
            <TextField
              label="教材"
              value={editor.textbook}
              required
              onChange={(event) => update('textbook', event.target.value)}
            />
            <TextField
              label="单元"
              value={editor.unit}
              required
              onChange={(event) => update('unit', event.target.value)}
            />
            <TextField
              label="标签"
              value={editor.tags}
              description="使用逗号分隔。"
              onChange={(event) => update('tags', event.target.value)}
            />

            {content.kind === 'word' ? (
              <>
                <div className={page.formRow}>
                  <TextField
                    label="单词"
                    value={editor.headword}
                    required
                    onChange={(event) => update('headword', event.target.value)}
                  />
                  <TextField
                    label="音标"
                    value={editor.phonetic}
                    onChange={(event) => update('phonetic', event.target.value)}
                  />
                </div>
                <TextAreaField
                  label="释义"
                  value={editor.meanings}
                  required
                  description="每行一项。"
                  onChange={(event) => update('meanings', event.target.value)}
                />
                <TextAreaField
                  label="例句"
                  value={editor.example}
                  onChange={(event) => update('example', event.target.value)}
                />
                <TextAreaField
                  label="例句翻译"
                  value={editor.exampleTranslation}
                  onChange={(event) => update('exampleTranslation', event.target.value)}
                />
                <TextAreaField
                  label="同义或可接受答案"
                  value={editor.aliases}
                  description="每行一项。"
                  onChange={(event) => update('aliases', event.target.value)}
                />
              </>
            ) : (
              <>
                <TextField
                  label="篇目"
                  value={editor.title}
                  required
                  onChange={(event) => update('title', event.target.value)}
                />
                <div className={page.formRow}>
                  <TextField
                    label="作者"
                    value={editor.author}
                    required
                    onChange={(event) => update('author', event.target.value)}
                  />
                  <TextField
                    label="朝代"
                    value={editor.dynasty}
                    required
                    onChange={(event) => update('dynasty', event.target.value)}
                  />
                </div>
                <TextAreaField
                  className={styles.tallArea}
                  label="正文"
                  value={editor.lines}
                  required
                  description="每行一句。"
                  onChange={(event) => update('lines', event.target.value)}
                />
                <TextAreaField
                  label="释义"
                  value={editor.translation}
                  onChange={(event) => update('translation', event.target.value)}
                />
                <TextAreaField
                  label="注释"
                  value={editor.notes}
                  description="每行一项。"
                  onChange={(event) => update('notes', event.target.value)}
                />
                <TextAreaField
                  label="考查要点"
                  value={editor.keyPoints}
                  description="每行一项。"
                  onChange={(event) => update('keyPoints', event.target.value)}
                />
              </>
            )}

            <div className={page.formRow}>
              <TextField
                label="内容来源"
                value={editor.source}
                required
                onChange={(event) => update('source', event.target.value)}
              />
              <TextField
                label="版本或版次"
                value={editor.version}
                onChange={(event) => update('version', event.target.value)}
              />
            </div>
            <TextAreaField
              label="修订说明"
              value={editor.note}
              description="说明本次修改原因，便于后续审核和追溯。"
              onChange={(event) => update('note', event.target.value)}
            />
            <div className={styles.stickyActions}>
              <Button type="submit" disabled={busy}>
                <Icon icon="lucide:save" />
                {busy ? '正在保存' : '保存新版本'}
              </Button>
            </div>
          </div>
        </Panel>

        <aside className={styles.detailAside}>
          <Panel>
            <div className={styles.asideSection}>
              <div className={styles.asideTitle}>
                <Icon icon="lucide:badge-check" />
                <h3>发布检查</h3>
              </div>
              {content.issues.length === 0 ? (
                <p className={styles.qualityReady}>当前版本通过完整性检查。</p>
              ) : (
                <ul className={styles.detailIssues}>
                  {content.issues.map((issue) => (
                    <li key={issue.code}>
                      <strong>{issue.message}</strong>
                      <span>{issue.field}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>

          <Panel>
            <div className={styles.asideSection}>
              <div className={styles.asideTitle}>
                <Icon icon="lucide:history" />
                <h3>修订记录</h3>
              </div>
              <ol className={styles.revisionList}>
                {content.revisions.map((revision) => (
                  <li key={revision.id}>
                    <div>
                      <strong>
                        v{revision.versionNumber} · {changeLabels[revision.changeKind]}
                      </strong>
                      <time dateTime={revision.createdAt}>
                        {new Date(revision.createdAt).toLocaleString('zh-CN')}
                      </time>
                    </div>
                    <p>{revision.note || '未填写修订说明'}</p>
                    <span>
                      {revision.actorName}
                      {revision.semanticChange ? ' · 学习答案发生变化' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>
        </aside>
      </form>
    </section>
  );
}
