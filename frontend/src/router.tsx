// src/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import CaseDashboardPage from './pages/CaseDashboardPage';
import IntakePage from './pages/IntakePage';
import InvestigationPage from './pages/InvestigationPage';
import PortalPage from './pages/PortalPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PortalPage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <AppShell />,
    children: [
      { path: '/cases', element: <CaseDashboardPage /> },
      { path: '/cases/:caseId/intake', element: <IntakePage /> },
      { path: '/cases/:caseId/entities/:entityId', element: <InvestigationPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/settings', element: <SettingsPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  }
]);