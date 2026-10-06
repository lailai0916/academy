import { lazy, Suspense, useState, type ComponentType } from 'react';
import { DataState } from '@lailai0916/ui';
import { matchRoutes, Navigate, Outlet, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { LoadingScreen } from './components/LoadingScreen';
import { pagePaths } from './routes';

function preloadable<Props extends object>(
  loader: () => Promise<{ default: ComponentType<Props> }>
) {
  let component: ComponentType<Props> | undefined;
  let promise: Promise<{ default: ComponentType<Props> }> | undefined;
  const preload = () =>
    (promise ??= loader().then((module) => {
      component = module.default;
      return module;
    }));
  const LazyComponent = lazy(preload);
  function Page(props: Props) {
    const [Component] = useState<ComponentType<Props>>(() => component ?? LazyComponent);
    return <Component {...props} />;
  }
  return Object.assign(Page, { preload });
}

const pageLoaders = {
  AdminPage: () => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })),
  AuthPage: () => import('./pages/AuthPage').then((module) => ({ default: module.AuthPage })),
  DashboardPage: () =>
    import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
  CoursesPage: () =>
    import('./pages/CoursesPage').then((module) => ({ default: module.CoursesPage })),
  CoursePlayerPage: () =>
    import('./pages/CoursePlayerPage').then((module) => ({ default: module.CoursePlayerPage })),
  LearnPage: () => import('./pages/LearnPage').then((module) => ({ default: module.LearnPage })),
  LandingPage: () =>
    import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
  MistakesPage: () =>
    import('./pages/MistakesPage').then((module) => ({ default: module.MistakesPage })),
  NotFoundPage: () =>
    import('./pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
  OnboardingPage: () =>
    import('./pages/OnboardingPage').then((module) => ({ default: module.OnboardingPage })),
  ProfilePage: () =>
    import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
  ProgressPage: () =>
    import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })),
  SessionPage: () =>
    import('./pages/SessionPage').then((module) => ({ default: module.SessionPage })),
  SettingsPage: () =>
    import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
  SocialPage: () => import('./pages/SocialPage').then((module) => ({ default: module.SocialPage })),
};

const loadAppShell = () =>
  import('./components/AppShell').then((module) => ({ default: module.AppShell }));
const AppShell = preloadable(loadAppShell);
const pages = {
  AdminPage: preloadable(pageLoaders.AdminPage),
  AuthPage: preloadable(pageLoaders.AuthPage),
  DashboardPage: preloadable(pageLoaders.DashboardPage),
  CoursesPage: preloadable(pageLoaders.CoursesPage),
  CoursePlayerPage: preloadable(pageLoaders.CoursePlayerPage),
  LearnPage: preloadable(pageLoaders.LearnPage),
  LandingPage: preloadable(pageLoaders.LandingPage),
  MistakesPage: preloadable(pageLoaders.MistakesPage),
  NotFoundPage: preloadable(pageLoaders.NotFoundPage),
  OnboardingPage: preloadable(pageLoaders.OnboardingPage),
  ProfilePage: preloadable(pageLoaders.ProfilePage),
  ProgressPage: preloadable(pageLoaders.ProgressPage),
  SessionPage: preloadable(pageLoaders.SessionPage),
  SettingsPage: preloadable(pageLoaders.SettingsPage),
  SocialPage: preloadable(pageLoaders.SocialPage),
};
const {
  AdminPage,
  AuthPage,
  DashboardPage,
  CoursesPage,
  CoursePlayerPage,
  LearnPage,
  LandingPage,
  MistakesPage,
  NotFoundPage,
  OnboardingPage,
  ProfilePage,
  ProgressPage,
  SessionPage,
  SettingsPage,
  SocialPage,
} = pages;
const pageRoutes = pagePaths.map(([path, page]) => ({ path, handle: page }));

export function preloadRoute(pathname: string) {
  const page = matchRoutes(pageRoutes, pathname)?.at(-1)?.route.handle ?? 'NotFoundPage';
  const modules = [pages[page].preload()];
  if (!['LandingPage', 'AuthPage', 'OnboardingPage', 'NotFoundPage'].includes(page))
    modules.push(AppShell.preload());
  return Promise.all(modules).catch(() => undefined);
}

function PageOutlet() {
  return (
    <Suspense fallback={<DataState message="正在加载页面……" />}>
      <Outlet />
    </Suspense>
  );
}

function ProtectedLayout() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return user.onboardingComplete ? <AppShell /> : <Navigate to="/onboarding" replace />;
}

function GuestRoute({ mode }: { mode: 'login' | 'register' }) {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? (
    <Navigate to={user.onboardingComplete ? '/dashboard' : '/onboarding'} replace />
  ) : (
    <AuthPage mode={mode} />
  );
}

function OnboardingRoute() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return user.onboardingComplete ? <Navigate to="/dashboard" replace /> : <OnboardingPage />;
}

function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminPage /> : <Navigate to="/dashboard" replace />;
}

export function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="/login" element={<GuestRoute mode="login" />} />
        <Route path="/register" element={<GuestRoute mode="register" />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route element={<ProtectedLayout />}>
          <Route element={<PageOutlet />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="courses" element={<CoursesPage />} />
            <Route path="courses/:courseSlug/run/:runId" element={<CoursePlayerPage />} />
            <Route path="learn" element={<LearnPage />} />
            <Route path="learn/words" element={<LearnPage kind="word" />} />
            <Route path="learn/poems" element={<LearnPage kind="poem" />} />
            <Route path="learn/mistakes" element={<MistakesPage />} />
            <Route path="learn/session/:sessionId" element={<SessionPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="social" element={<SocialPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin/*" element={<AdminRoute />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
