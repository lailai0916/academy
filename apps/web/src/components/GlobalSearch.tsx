import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import type { WorkspaceSearchResult } from '@lailai/academy-shared';
import { Icon } from './Icon';
import { api } from '../lib/api';
import styles from './GlobalSearch.module.css';

const destinations = [
  { id: 'today', title: '今日学习', detail: '计划与长期记忆指标', href: '/dashboard' },
  { id: 'learn', title: '学习中心', detail: '单词、古诗词与教材单元', href: '/learn' },
  { id: 'mistakes', title: '错题本', detail: '历史错误与针对性巩固', href: '/learn/mistakes' },
  { id: 'progress', title: '学习分析', detail: '准确率、活跃天数与薄弱单元', href: '/progress' },
  { id: 'social', title: '同学', detail: '动态、好友、学习小组与挑战', href: '/social' },
  { id: 'profile', title: '个人主页', detail: '个人资料与学习结果', href: '/profile' },
  { id: 'settings', title: '设置', detail: '资料、目标与外观', href: '/settings' },
] as const;

export function GlobalSearch() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
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
      if (event.key === 'Escape' && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key === 'Tab' && open) {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled])'
          ) ?? []
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    setQuery('');
    setResults([]);
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
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
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="搜索学习内容和功能"
        onClick={() => setOpen(true)}
      >
        <Icon icon="lucide:search" />
        <span>搜索学习内容或功能</span>
        <kbd>⌘K</kbd>
      </button>

      {open && (
        <div className={styles.backdrop} role="presentation" onMouseDown={close}>
          <section
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-label="全局搜索"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.searchBox}>
              <Icon icon="lucide:search" />
              <label className="sr-only" htmlFor="workspace-search">
                搜索
              </label>
              <input
                ref={inputRef}
                id="workspace-search"
                value={query}
                placeholder="搜索单词、古诗词、同学或功能"
                autoComplete="off"
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" aria-label="关闭搜索" onClick={close}>
                <Icon icon="lucide:x" />
              </button>
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

              {loading && <p className={styles.status}>正在搜索……</p>}
              {!loading && query.trim() && localResults.length === 0 && results.length === 0 && (
                <p className={styles.status}>没有匹配结果，请尝试教材单元、内容名称或用户名。</p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
