import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link as RouterLink } from 'react-router';
import { LaikitProvider, ThemeProvider, type LinkProps } from '@lailai0916/ui';
import '@lailai0916/ui/theme.css';
import '@lailai0916/ui/styles.css';
import { AuthProvider } from './auth/AuthProvider';
import { App, preloadRoute } from './App';
import { LoadingScreen } from './components/LoadingScreen';
import { PageErrorBoundary } from './components/PageErrorBoundary';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root not found');
}

const initialRoute = preloadRoute(window.location.pathname);

function AppBootstrap() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void initialRoute.then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);
  return ready ? <App /> : <LoadingScreen />;
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider mode="system" themeColors={{ light: '#f6f6f8', dark: '#111214' }}>
      <BrowserRouter>
        <LaikitProvider locale="zh-Hans" linkComponent={AppLink}>
          <AuthProvider>
            <PageErrorBoundary>
              <AppBootstrap />
            </PageErrorBoundary>
          </AuthProvider>
        </LaikitProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);

function AppLink({ to, href, ...props }: LinkProps) {
  const target = to ?? href ?? '/';
  return target.startsWith('/') && !target.startsWith('//') ? (
    <RouterLink {...props} to={target} />
  ) : (
    <a {...props} href={target} />
  );
}
