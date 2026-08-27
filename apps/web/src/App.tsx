import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/LoadingScreen';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { LearnPage } from './pages/LearnPage';
import { LandingPage } from './pages/LandingPage';
import { MistakesPage } from './pages/MistakesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { ProfilePage } from './pages/ProfilePage';
import { ProgressPage } from './pages/ProgressPage';
import { SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';
import { SocialPage } from './pages/SocialPage';

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
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="/login" element={<GuestRoute mode="login" />} />
      <Route path="/register" element={<GuestRoute mode="register" />} />
      <Route path="/onboarding" element={<OnboardingRoute />} />
      <Route element={<ProtectedLayout />}>
        <Route path="dashboard" element={<DashboardPage />} />
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
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
