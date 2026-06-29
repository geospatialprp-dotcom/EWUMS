import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import MapPage from './pages/MapPage';
import DashboardPage from './pages/DashboardPage';
import AssetsPage from './pages/AssetsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectFeatureClassesPage from './pages/ProjectFeatureClassesPage';
import ProjectConstructionPage from './pages/ProjectConstructionPage';
import OmManagementPage from './pages/OmManagementPage';
import ConsumerComplaintsPage from './pages/ConsumerComplaintsPage';
import DprPlanningPage from './pages/DprPlanningPage';
import LandAcquisitionPage from './pages/LandAcquisitionPage';
import LaCaseWorkspacePage from './pages/LaCaseWorkspacePage';
import BillingRevenuePage from './pages/BillingRevenuePage';
import PlatformModulesPage from './pages/PlatformModulesPage';
import MobileBillingPage from './pages/MobileBillingPage';
import ConsumerPortalLoginPage from './pages/ConsumerPortalLoginPage';
import ConsumerPortalPage from './pages/ConsumerPortalPage';
import WorkflowInboxPage from './pages/WorkflowInboxPage';
import UsersPage from './pages/admin/UsersPage';
import RolesPage from './pages/admin/RolesPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import NotificationSettingsPage from './pages/admin/NotificationSettingsPage';
import PermissionRoute from './components/auth/PermissionRoute';
import { useConsumerPortal } from './context/ConsumerPortalContext';
import { Box, CircularProgress } from '@mui/material';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" sx={{ bgcolor: '#f1f5f9' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PortalProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useConsumerPortal();
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh" sx={{ bgcolor: '#f1f5f9' }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!token) return <Navigate to="/portal/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/portal/login" element={<ConsumerPortalLoginPage />} />
      <Route
        path="/portal"
        element={(
          <PortalProtectedRoute>
            <ConsumerPortalPage />
          </PortalProtectedRoute>
        )}
      />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/mobile-billing"
        element={(
          <ProtectedRoute>
            <PermissionRoute permission="om:read">
              <MobileBillingPage />
            </PermissionRoute>
          </ProtectedRoute>
        )}
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/map" replace />} />
                <Route path="/platform" element={<PlatformModulesPage />} />
                <Route path="/map" element={
                  <PermissionRoute permissions={['layer:read', 'project:read']}><MapPage /></PermissionRoute>
                } />
                <Route path="/dashboard" element={
                  <PermissionRoute permission="dashboard:read"><DashboardPage /></PermissionRoute>
                } />
                <Route path="/assets" element={
                  <PermissionRoute permission="asset:read"><AssetsPage /></PermissionRoute>
                } />
                <Route path="/projects" element={
                  <PermissionRoute permission="project:read"><ProjectsPage /></PermissionRoute>
                } />
                <Route path="/projects/:projectId/feature-classes" element={
                  <PermissionRoute permission="project:read"><ProjectFeatureClassesPage /></PermissionRoute>
                } />
                <Route path="/projects/:projectId/construction" element={
                  <PermissionRoute permissions={['project:read', 'construction:read']}>
                    <ProjectConstructionPage />
                  </PermissionRoute>
                } />
                <Route path="/dpr-planning" element={
                  <PermissionRoute permission="dpr_proposal:read"><DprPlanningPage /></PermissionRoute>
                } />
                <Route path="/land-acquisition" element={
                  <PermissionRoute permission="la_case:read"><LandAcquisitionPage /></PermissionRoute>
                } />
                <Route path="/land-acquisition/:caseId" element={
                  <PermissionRoute permission="la_case:read"><LaCaseWorkspacePage /></PermissionRoute>
                } />
                <Route path="/om" element={
                  <PermissionRoute permission="om:read"><OmManagementPage /></PermissionRoute>
                } />
                <Route path="/complaints" element={
                  <PermissionRoute permission="om:read"><ConsumerComplaintsPage /></PermissionRoute>
                } />
                <Route path="/billing" element={
                  <PermissionRoute permission="om:read"><BillingRevenuePage /></PermissionRoute>
                } />
                <Route path="/workflows" element={<WorkflowInboxPage />} />
                <Route path="/admin/users" element={
                  <PermissionRoute permission="user:read"><UsersPage /></PermissionRoute>
                } />
                <Route path="/admin/roles" element={
                  <PermissionRoute permission="user:read"><RolesPage /></PermissionRoute>
                } />
                <Route path="/admin/audit" element={
                  <PermissionRoute permission="audit:read"><AuditLogsPage /></PermissionRoute>
                } />
                <Route path="/admin/notifications" element={
                  <PermissionRoute permission="om:read"><NotificationSettingsPage /></PermissionRoute>
                } />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
