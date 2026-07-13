import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';

export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const { toast, clearToast, sidebarCollapsed } = useUIStore();
  const { loadCases } = useCaseStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication Guard (Temporary Client-Side Redirect)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  // Load cases at start
  useEffect(() => {
    if (isAuthenticated) {
      loadCases();
    }
  }, [isAuthenticated, loadCases]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300`}>
        {/* Top Header Controls */}
        <TopBar />

        {/* Dynamic Outlet Page Wrapper */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 relative">
          <Outlet />
        </main>
      </div>

      {/* Global Toast Notification System */}
      {toast && (
        <div 
          onClick={clearToast}
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl cursor-pointer hover:opacity-90 animate-bounce duration-500 ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200' 
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : 'bg-slate-900/90 border-indigo-800 text-slate-200'
          }`}
        >
          <span className="text-sm font-medium">{toast.message}</span>
          <button className="text-xs opacity-65 hover:opacity-100">&times;</button>
        </div>
      )}
    </div>
  );
}
