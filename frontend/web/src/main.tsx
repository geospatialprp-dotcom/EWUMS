import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { DivisionProvider } from './context/DivisionContext';
import { ConsumerPortalProvider } from './context/ConsumerPortalContext';
import { DepartmentProvider } from './context/DepartmentContext';
import { LanguageProvider } from './context/LanguageContext';
import { initLocale } from './i18n';
import { theme } from './theme';
import { ThemeProvider, CssBaseline } from '@mui/material';

initLocale();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <LanguageProvider>
          <AuthProvider>
            <DivisionProvider>
              <ConsumerPortalProvider>
                <DepartmentProvider>
                  <App />
                </DepartmentProvider>
              </ConsumerPortalProvider>
            </DivisionProvider>
          </AuthProvider>
        </LanguageProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
