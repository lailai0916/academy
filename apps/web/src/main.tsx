import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { ThemeProvider } from '@lailai0916/ui';
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
    <ThemeProvider themeColors={{ light: '#f6f6f8', dark: '#111214' }}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
