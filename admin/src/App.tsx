import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { GoogleSheetsPage } from './pages/GoogleSheetsPage';
import { JobsPage } from './pages/JobsPage';
import { KnowledgeStatsPage } from './pages/KnowledgeStatsPage';
import { KppdfConnectionPage } from './pages/KppdfConnectionPage';
import { LoginPage } from './pages/LoginPage';
import { ModelsPage } from './pages/ModelsPage';
import { NewsPreviewPage } from './pages/NewsPreviewPage';
import { NewsSettingsPage } from './pages/NewsSettingsPage';
import { ProvidersPage } from './pages/ProvidersPage';
import { RunsPage } from './pages/RunsPage';
import { getToken } from './api/client';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="kppdf" element={<KppdfConnectionPage />} />
        <Route path="google-sheets" element={<GoogleSheetsPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="news-settings" element={<NewsSettingsPage />} />
        <Route path="news" element={<NewsPreviewPage />} />
        <Route path="knowledge" element={<KnowledgeStatsPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="models" element={<ModelsPage />} />
        <Route path="runs" element={<RunsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? '/' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppRoutes />
      </HashRouter>
    </AuthProvider>
  );
}
