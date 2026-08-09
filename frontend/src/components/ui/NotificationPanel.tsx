import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Circle } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead, clearAllNotifications } from '../../api/endpoints';
import type { NotificationData } from '../../api/endpoints';
import { useTranslation } from 'react-i18next';
import { useTransliterate } from './Transliterate';
import { useDashboardContext } from '../../pages/DashboardContext';

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { t, i18n } = useTranslation();
  const transliterate = useTransliterate();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { openWindow, cases } = useDashboardContext();

  const fetchNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleNotificationClick = async (n: NotificationData) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
      } catch (e) {
        console.error(e);
      }
    }
    const targetCase = cases.find(c => c.caseId === n.case_id);
    const title = targetCase ? targetCase.title : `Case Workspace: ${n.case_id}`;
    openWindow(
      `workspace-${n.case_id}`,
      t('dashboard.case_workspace', { title: title.replace('Case Workspace: ', '') }),
      'case_workspace',
      { caseId: n.case_id, activeTab: 'graph' }
    );
    setIsOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div ref={containerRef} className="relative font-mono">
      <button 
        data-tutorial="notifications-bell"
        onClick={() => setIsOpen(!isOpen)}
        title={t('notifications.title', 'Notifications')}
        className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center relative ${
          isOpen 
            ? 'text-[#39ff14] bg-white/5 border border-white/10' 
            : 'text-gray-300 hover:text-[#39ff14] hover:bg-white/5'
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-[#0a0f18]"></span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 left-4 right-4 sm:absolute sm:right-0 sm:bottom-full sm:left-auto sm:mb-2 sm:w-[320px] bg-[#080d16]/95 border border-[#39ff14]/20 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-[#39ff14]/15 flex items-center justify-between font-mono">
              <h3 className="text-xs font-bold text-[#39ff14] uppercase tracking-widest">{t('notifications.title', 'Notifications')}</h3>
              {unreadCount > 0 && (
                <span className="text-[9px] bg-red-500/10 border border-red-500/35 text-red-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                  {unreadCount} {t('notifications.unread', 'unread')}
                </span>
              )}
            </div>
            
            <div className="px-4 py-2 bg-white/5 border-b border-[#39ff14]/10 flex justify-between gap-4 text-[9px] font-mono select-none">
              <button 
                onClick={handleMarkAllRead} 
                className="text-gray-400 hover:text-[#39ff14] transition-colors uppercase tracking-wider font-bold"
              >
                ✓ {t('notifications.read_all', 'Read All')}
              </button>
              <button 
                onClick={handleClearAll} 
                className="text-gray-400 hover:text-red-400 transition-colors uppercase tracking-wider font-bold"
              >
                ✗ {t('notifications.clear_all', 'Clear All')}
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-xs font-mono uppercase tracking-wider">
                  {t('notifications.empty', 'No notifications yet.')}
                </div>
              ) : (
                <div className="divide-y divide-[#39ff14]/10">
                  {notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3.5 flex gap-3 hover:bg-[#39ff14]/5 cursor-pointer transition-colors ${!n.is_read ? 'bg-[#39ff14]/5' : ''}`}
                    >
                      <button 
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="mt-0.5 flex-shrink-0 text-gray-500 hover:text-[#39ff14] transition-colors"
                      >
                        {n.is_read ? <CheckCircle2 size={14} className="text-[#39ff14]/60" /> : <Circle size={14} className="text-[#39ff14]" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-mono leading-relaxed break-words ${!n.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
                          {transliterate(n.message)}
                        </p>
                        <span className="text-[8px] font-mono text-gray-500 mt-1 block tracking-wider">
                          {new Date(n.created_at).toLocaleString(i18n.language === 'en' ? 'en-US' : i18n.language === 'hi' ? 'hi-IN' : 'gu-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      )}
    </div>
  );
}
