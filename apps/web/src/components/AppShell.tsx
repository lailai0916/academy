import { Avatar, Brand } from '@lailai/ui';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Icon } from './Icon';
import styles from './AppShell.module.css';

const navigation = [
  { to: '/dashboard', label: '今天', icon: 'lucide:house' },
  { to: '/learn', label: '学习', icon: 'lucide:book-open' },
  { to: '/social', label: '同学', icon: 'lucide:users' },
  { to: '/profile', label: '我的', icon: 'lucide:user-round' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className={styles.sidebar}>
        <NavLink to="/dashboard" className={styles.brand} aria-label="返回今天">
          <Brand logoSrc="/brand/logo.svg" name="lailai's Academy" />
        </NavLink>
        <nav className={styles.navigation} aria-label="主导航">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon icon={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink
              to="/admin"
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon icon="lucide:shield-check" />
              <span>管理</span>
            </NavLink>
          )}
          <NavLink
            to="/settings"
            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
          >
            <Icon icon="lucide:settings-2" />
            <span>设置</span>
          </NavLink>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <Avatar name={user?.displayName ?? '?'} alt="个人头像" size={36} />
            <div className={styles.accountCopy}>
              <strong>{user?.displayName}</strong>
              <span>@{user?.username}</span>
            </div>
            <button
              type="button"
              className={styles.logout}
              onClick={handleLogout}
              aria-label="退出登录"
            >
              <Icon icon="lucide:log-out" />
            </button>
          </div>
        </div>
      </aside>

      <header className={styles.mobileHeader}>
        <NavLink to="/dashboard" aria-label="返回今天">
          <Brand logoSrc="/brand/logo.svg" name="Academy" />
        </NavLink>
        <div className={styles.mobileActions}>
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={styles.mobileIcon} aria-label="打开管理控制台">
              <Icon icon="lucide:shield-check" />
            </NavLink>
          )}
          <NavLink to="/settings" className={styles.mobileAccount} aria-label="打开设置">
            <Avatar name={user?.displayName ?? '?'} alt="个人头像" size={34} />
          </NavLink>
        </div>
      </header>

      <main id="main-content" className={styles.main} key={location.pathname}>
        <Outlet />
      </main>

      <nav className={styles.bottomNav} aria-label="移动端主导航">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => `${styles.bottomItem} ${isActive ? styles.active : ''}`}
          >
            <Icon icon={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
