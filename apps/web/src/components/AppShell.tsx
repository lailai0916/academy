import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Brand, IconButton, ThemeControl } from '@lailai/ui';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { GlobalSearch } from './GlobalSearch';
import { Icon } from './Icon';
import { NotificationsMenu } from './NotificationsMenu';
import styles from './AppShell.module.css';

type NavigationItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

const navigation: { label: string; items: NavigationItem[] }[] = [
  {
    label: '学习',
    items: [
      { to: '/dashboard', label: '今日学习', icon: 'lucide:house', end: true },
      { to: '/learn', label: '学习中心', icon: 'lucide:book-open', end: true },
      { to: '/learn/words', label: '英语词汇', icon: 'lucide:languages', end: true },
      { to: '/learn/poems', label: '古诗词', icon: 'lucide:feather', end: true },
      { to: '/learn/mistakes', label: '错题本', icon: 'lucide:notebook-tabs', end: true },
      { to: '/progress', label: '学习分析', icon: 'lucide:chart-no-axes-combined', end: true },
    ],
  },
  {
    label: '社区',
    items: [{ to: '/social', label: '同学', icon: 'lucide:users' }],
  },
  {
    label: '账号',
    items: [{ to: '/settings', label: '设置', icon: 'lucide:settings-2' }],
  },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    if (previousPath.current !== location.pathname) {
      window.requestAnimationFrame(() =>
        document.getElementById('main-content')?.focus({ preventScroll: true })
      );
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [menuOpen]);

  const allItems = useMemo(() => navigation.flatMap((group) => group.items), []);
  const current = [...allItems]
    .sort((left, right) => right.to.length - left.to.length)
    .find((item) =>
      item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
    );
  const currentLabel = location.pathname.startsWith('/admin')
    ? '管理'
    : location.pathname.startsWith('/learn/session')
      ? '学习任务'
      : location.pathname === '/profile' || location.pathname.startsWith('/profile/')
        ? '个人主页'
        : (current?.label ?? 'Academy');

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>

      <header className={styles.topbar}>
        <div className={styles.brandArea}>
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.menuButton}
            aria-label={menuOpen ? '关闭主菜单' : '打开主菜单'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((currentOpen) => !currentOpen)}
          >
            <Icon icon={menuOpen ? 'lucide:x' : 'lucide:menu'} />
          </button>
          <NavLink to="/dashboard" aria-label="返回今日学习">
            <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
          </NavLink>
        </div>

        <div className={styles.location} aria-label="当前位置">
          <strong>{currentLabel}</strong>
        </div>

        <div className={styles.topbarTools}>
          <GlobalSearch />
          <NotificationsMenu />
          <ThemeControl
            variant="compact"
            labels={{ system: '跟随系统', light: '浅色', dark: '深色' }}
          />
          <span className={styles.divider} aria-hidden="true" />
          <NavLink className={styles.accountButton} to="/profile" aria-label="打开个人主页">
            <Avatar name={user?.displayName ?? '?'} alt="个人头像" size={32} />
            <span>{user?.displayName}</span>
          </NavLink>
          <IconButton
            className={styles.logoutButton}
            label="退出登录"
            size="small"
            disabled={loggingOut}
            onClick={() => void handleLogout()}
          >
            <Icon icon="lucide:log-out" />
          </IconButton>
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className={styles.mobileBackdrop}
          aria-label="关闭主菜单"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <NavLink
          className={({ isActive }) =>
            `${styles.userCard} ${isActive ? styles.userCardActive : ''}`
          }
          to="/profile"
          end
          aria-label="打开个人主页"
        >
          <Avatar name={user?.displayName ?? '?'} alt="个人头像" size={36} />
          <span>
            <strong>{user?.displayName}</strong>
            <small>
              @{user?.username} · {user?.grade}
            </small>
          </span>
          <span className={styles.role}>{user?.role === 'admin' ? '管理员' : '学生'}</span>
        </NavLink>

        <nav className={styles.navigation} aria-label="主导航">
          {navigation.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                >
                  <Icon icon={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          {user?.role === 'admin' && (
            <div className={styles.navGroup}>
              <p>系统</p>
              <NavLink
                to="/admin"
                className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              >
                <Icon icon="lucide:shield-check" />
                <span>管理</span>
              </NavLink>
            </div>
          )}
        </nav>
      </aside>

      <main
        id="main-content"
        className={styles.main}
        tabIndex={-1}
        inert={menuOpen ? true : undefined}
      >
        <Outlet />
      </main>
    </div>
  );
}
