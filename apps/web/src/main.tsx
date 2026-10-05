import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link as RouterLink } from 'react-router';
import { LaikitProvider, ThemeProvider, type LinkProps } from '@lailai0916/ui';
import '@lailai0916/ui/theme.css';
import '@lailai0916/ui/styles.css';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root not found');
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider mode="system" themeColors={{ light: '#f6f6f8', dark: '#111214' }}>
      <BrowserRouter>
        <LaikitProvider locale="zh-Hans" linkComponent={AppLink}>
          <AuthProvider>
            <App />
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
