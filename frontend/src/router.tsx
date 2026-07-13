// src/router.tsx
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import CaseDashboardPage from './pages/CaseDashboardPage';
import IntakePage from './pages/IntakePage';
import InvestigationPage from './pages/InvestigationPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { path: '', element: <Navigate to="/cases" replace /> },
      { path: 'cases', element: <CaseDashboardPage /> },
      { path: 'cases/:caseId/intake', element: <IntakePage /> },
      { path: 'cases/:caseId/entities/:entityId', element: <InvestigationPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/cases" replace />,
  }
]);