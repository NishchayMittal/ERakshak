import React, { useEffect, useState, useRef } from 'react';
import { Bell, Check, Eye, AlertTriangle } from 'lucide-react';
import { getAlerts, getUnreadAlertCount, markAlertRead, markAllAlertsRead } from '../../api/endpoints';
import type { AlertItem } from '../../api/endpoints';

export default function AlertBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount + poll every 30s
  useEffect(() => {
    const fetchCount = () => {
      getUnreadAlertCount().then(r => setUnread(r.unread_count)).catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 30000);
    return () => clearInterval(id);
  }, []);

  // Fetch full alerts when dropdown opens
  useEffect(() => {
    if (open) {
      getAlerts().then(setAlerts).catch(() => {});
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkRead = async (alertId: string) => {
    await markAlertRead(alertId);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    setUnread(0);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'JUST NOW';
    if (diffMin < 60) return `${diffMin}m AGO`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h AGO`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d AGO`;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent',
          border: '1px solid var(--struct-line)',
          color: unread > 0 ? 'var(--accent-threat)' : 'var(--text-muted)',
          cursor: 'pointer',
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.boxShadow = '0 0 8px rgba(0,255,194,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--struct-line)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <Bell size={14} />
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: 'var(--accent-threat)',
            color: '#000',
            fontSize: 8,
            fontWeight: 900,
            fontFamily: 'var(--font-mono)',
            minWidth: 14,
            height: 14,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 6px var(--accent-threat)',
            animation: 'intro-live-pulse 1s ease infinite',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: 380,
          maxHeight: 440,
          background: 'var(--bg-0)',
          border: '1px solid var(--struct-line)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 1px var(--accent-primary)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--struct-line)',
            background: 'var(--bg-1)',
          }}>
            <span style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: 'var(--accent-primary)',
              textTransform: 'uppercase',
            }}>
              ▶ WATCHLIST ALERTS
            </span>
            {unread > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--struct-line)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  padding: '3px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <Check size={10} /> MARK ALL READ
              </button>
            )}
          </div>

          {/* Alert List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {alerts.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
              }}>
                NO ALERTS — WATCHLIST MONITORING ACTIVE
              </div>
            ) : (
              alerts.map(alert => (
                <div
                  key={alert.id}
                  onClick={() => !alert.is_read && handleMarkRead(alert.id)}
                  style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: alert.is_read ? 'default' : 'pointer',
                    background: alert.is_read ? 'transparent' : 'rgba(0,255,194,0.03)',
                    transition: 'background 0.2s',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={(e) => {
                    if (!alert.is_read) e.currentTarget.style.background = 'rgba(0,255,194,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = alert.is_read ? 'transparent' : 'rgba(0,255,194,0.03)';
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    flexShrink: 0,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${alert.is_read ? 'var(--struct-line)' : 'var(--accent-primary)'}`,
                    color: alert.is_read ? 'var(--text-muted)' : 'var(--accent-primary)',
                  }}>
                    {alert.is_read ? <Eye size={12} /> : <AlertTriangle size={12} />}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: alert.is_read ? 'var(--text-muted)' : 'var(--text-primary)',
                      lineHeight: 1.4,
                      marginBottom: 4,
                    }}>
                      {alert.title}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 9,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.1em',
                    }}>
                      <span>{alert.alert_type.toUpperCase().replace('_', ' ')}</span>
                      <span style={{ color: 'var(--struct-line)' }}>│</span>
                      <span>{formatTime(alert.created_at)}</span>
                      {!alert.is_read && (
                        <>
                          <span style={{ color: 'var(--struct-line)' }}>│</span>
                          <span style={{ color: 'var(--accent-primary)' }}>● NEW</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
