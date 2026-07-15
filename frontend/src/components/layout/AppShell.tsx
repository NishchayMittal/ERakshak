import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../../hooks/useAuth';
import { useUIStore } from '../../state/uiStore';
import { useCaseStore } from '../../state/caseStore';

export default function AppShell() {
  const { isAuthenticated } = useAuth();
  const { toast, clearToast } = useUIStore();
  const { loadCases } = useCaseStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Authentication Guard (Temporary Client-Side Redirect)
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
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
      <div className="flex flex-col flex-1 overflow-hidden transition-all duration-300">
        {/* Top Header Controls */}
        <TopBar />

        {/* Dynamic Outlet Page Wrapper with motion transition */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-6 relative cyber-grid opacity-90">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Global Toast Notification System */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={clearToast}
            className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl cursor-pointer hover:opacity-90 ${
              toast.type === 'success' 
                ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200 glow-shadow-emerald' 
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-800 text-rose-200'
                : 'bg-slate-900/90 border-indigo-800 text-slate-200'
            }`}
          >
            <span className="text-sm font-medium font-sans">{toast.message}</span>
            <button className="text-xs opacity-65 hover:opacity-100">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

