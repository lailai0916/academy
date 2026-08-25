import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import type { NotificationItem } from '@lailai/academy-shared';
import { Icon } from './Icon';
import { api } from '../lib/api';
import styles from './NotificationsMenu.module.css';

export function NotificationsMenu() {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const response = await api<{ notifications: NotificationItem[]; unreadCount: number }>(
      '/notifications'
    );
    setItems(response.notifications);
    setUnread(response.unreadCount);
  };

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || unread === 0) return;
    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    await api('/notifications/read', { method: 'POST' }).catch(() => undefined);
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label="通知"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Icon icon="lucide:bell" />
        {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <section className={styles.menu} role="dialog" aria-label="通知">
          <header>
            <h2>通知</h2>
          </header>
          <div className={styles.list}>
            {loading ? (
              <p className={styles.empty}>正在读取通知……</p>
            ) : items.length === 0 ? (
              <p className={styles.empty}>当前没有通知。</p>
            ) : (
              items.map((item) => {
                const content = (
                  <>
                    <span className={styles.itemIcon}>
                      <Icon icon="lucide:bell" />
                    </span>
                    <span className={styles.itemCopy}>
                      <strong>{item.title}</strong>
                      <span>{item.body}</span>
                      <time dateTime={item.createdAt}>
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </time>
                    </span>
                  </>
                );
                return item.link ? (
                  <NavLink
                    key={item.id}
                    to={item.link}
                    className={!item.read ? styles.unread : ''}
                    onClick={() => setOpen(false)}
                  >
                    {content}
                  </NavLink>
                ) : (
                  <article key={item.id} className={!item.read ? styles.unread : ''}>
                    {content}
                  </article>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
