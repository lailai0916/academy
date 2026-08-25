import { Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { LoadingScreen } from './components/LoadingScreen';
import { AdminPage } from './pages/AdminPage';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { LearnPage } from './pages/LearnPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { SessionPage } from './pages/SessionPage';
import { SettingsPage } from './pages/SettingsPage';
import { SocialPage } from './pages/SocialPage';

function ProtectedLayout() {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <AppShell /> : <Navigate to="/login" replace />;
}

function GuestRoute({ mode }: { mode: 'login' | 'register' }) {
  const { loading, user } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/" replace /> : <AuthPage mode={mode} />;
}

function AdminRoute() {
  const { user } = useAuth();
  return user?.role === 'admin' ? <AdminPage /> : <Navigate to="/" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestRoute mode="login" />} />
      <Route path="/register" element={<GuestRoute mode="register" />} />
      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="learn/words" element={<LearnPage kind="word" />} />
        <Route path="learn/poems" element={<LearnPage kind="poem" />} />
        <Route path="learn/session/:sessionId" element={<SessionPage />} />
        <Route path="social" element={<SocialPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="admin" element={<AdminRoute />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
