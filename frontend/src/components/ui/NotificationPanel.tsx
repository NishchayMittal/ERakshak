import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Circle } from 'lucide-react';
import { getNotifications, markNotificationRead } from '../../api/endpoints';
import type { NotificationData } from '../../api/endpoints';
import { useTranslation } from 'react-i18next';
import { useTransliterate } from './Transliterate';

export function NotificationPanel() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();
  const transliterate = useTransliterate();

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
    // Poll every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) {
      console.error(e);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#0a0f18]"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 bottom-full mb-2 w-80 bg-[#111827] border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">{t('notifications.title', 'Notifications')}</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {unreadCount} {t('notifications.unread', 'unread')}
                </span>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  {t('notifications.empty', 'No notifications yet.')}
                </div>
              ) : (
                <div className="divide-y divide-gray-800/50">
                  {notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`p-4 flex gap-3 hover:bg-white/5 transition-colors ${!n.is_read ? 'bg-[#39ff14]/5' : ''}`}
                    >
                      <button 
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="mt-1 flex-shrink-0 text-gray-500 hover:text-[#39ff14] transition-colors"
                      >
                        {n.is_read ? <CheckCircle2 size={16} /> : <Circle size={16} className="text-[#39ff14]" />}
                      </button>
                      <div>
                        <p className={`text-sm ${!n.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
                          {transliterate(n.message)}
                        </p>
                        <span className="text-xs text-gray-500 mt-1 block">
                          {new Date(n.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
