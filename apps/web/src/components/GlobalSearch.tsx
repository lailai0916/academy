import { Button, DataState, Dialog, EmptyState, IconButton, Input } from '@lailai0916/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import type { WorkspaceSearchResult } from '@lailai/academy-shared';
import { Icon } from './Icon';
import { api } from '../lib/api';
import styles from './GlobalSearch.module.css';

const destinations = [
  { id: 'today', title: '今日学习', detail: '计划与长期记忆指标', href: '/dashboard' },
  { id: 'courses', title: '学科课程', detail: '六科课程与首个物理样例', href: '/courses' },
  { id: 'learn', title: '记忆训练', detail: '英语词汇、古诗词与间隔复习', href: '/learn' },
  { id: 'words', title: '英语词汇', detail: '人教版教材词汇', href: '/learn/words' },
  { id: 'poems', title: '古诗词', detail: '部编版教材古诗词', href: '/learn/poems' },
  { id: 'mistakes', title: '错题本', detail: '历史错误与针对性巩固', href: '/learn/mistakes' },
  { id: 'progress', title: '学习分析', detail: '准确率、活跃天数与薄弱单元', href: '/progress' },
  { id: 'social', title: '同学', detail: '动态、好友、学习小组与挑战', href: '/social' },
  { id: 'profile', title: '个人主页', detail: '个人资料与学习结果', href: '/profile' },
  { id: 'settings', title: '设置', detail: '个人资料、密码与登录设备', href: '/settings' },
] as const;

export function GlobalSearch() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WorkspaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !event.isComposing &&
        event.key.toLowerCase() === 'k' &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
  }, [open]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api<{ results: WorkspaceSearchResult[] }>(
          `/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        setResults(response.results);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const localResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((item) =>
      `${item.title} ${item.detail}`.toLowerCase().includes(normalized)
    );
  }, [query]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <Button
        leftIcon={<Icon icon="lucide:search" />}
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="搜索学习内容和功能"
        title="搜索学习内容和功能（⌘K / Ctrl+K）"
        onClick={() => setOpen(true)}
      >
        <span className={styles.triggerText}>搜索学习内容或功能</span>
        <kbd>⌘K</kbd>
      </Button>

      <Dialog open={open} onClose={close} label="全局搜索">
        <div className={styles.searchBox}>
          <Icon icon="lucide:search" />
          <label className="sr-only" htmlFor="workspace-search">
            搜索
          </label>
          <Input
            autoFocus
            ref={inputRef}
            id="workspace-search"
            value={query}
            placeholder="搜索课程、词汇、古诗词、同学或功能"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
          <IconButton label="关闭搜索" onClick={close}>
            <Icon icon="lucide:x" />
          </IconButton>
        </div>

        <div className={styles.results} aria-busy={loading}>
          {localResults.length > 0 && (
            <div className={styles.group}>
              <p>功能</p>
              {localResults.map((item) => (
                <NavLink key={item.id} to={item.href} onClick={close}>
                  <span className={styles.resultIcon}>
                    <Icon icon="lucide:arrow-right" />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </NavLink>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div className={styles.group}>
              <p>内容与同学</p>
              {results.map((item) => (
                <NavLink key={`${item.type}-${item.id}`} to={item.href} onClick={close}>
                  <span className={styles.resultIcon}>
                    <Icon
                      icon={item.type === 'content' ? 'lucide:book-open' : 'lucide:user-round'}
                    />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </NavLink>
              ))}
            </div>
          )}

          {loading && <DataState message="正在搜索……" />}
          {!loading && query.trim() && localResults.length === 0 && results.length === 0 && (
            <EmptyState title="没有匹配结果" description="请尝试课程、教材单元或用户名。" />
          )}
        </div>
      </Dialog>
    </>
  );
}
