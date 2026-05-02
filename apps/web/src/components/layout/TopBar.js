'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Moon, Sun, Search } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useNotificationStore } from '@/store/socketStore';
import { notificationsApi, workspacesApi } from '@/lib/api';
import { format } from 'date-fns';
import { useWorkspaceStore } from '@/store/workspaceStore';
import clsx from 'clsx';
import toast from 'react-hot-toast';

export default function TopBar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const { notifications, unreadCount, setNotifications, markRead, markAllRead } = useNotificationStore();
  const notifRef = useRef(null);
  const { currentWorkspace, fetchWorkspaces } = useWorkspaceStore();
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    notificationsApi.list({ limit: 20 }).then(({ data }) => {
      setNotifications(data.notifications, data.unreadCount);
    }).catch(() => {});
  }, []);

  // Click outside to close
  useEffect(() => {
    const handle = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const handleMarkRead = async (id) => {
    markRead(id);
    await notificationsApi.markRead(id).catch(() => {});
  };

  const handleMarkAllRead = async () => {
    markAllRead();
    await notificationsApi.markAllRead().catch(() => {});
  };

  const handleAcceptInvite = async (e, n) => {
    e.stopPropagation();
    if (!n.link) return;
    const token = n.link.split('/invite/')[1];
    if (!token) return;
    
    try {
      await workspacesApi.acceptInvite(token);
      await fetchWorkspaces();
      toast.success('Successfully joined workspace!');
      handleMarkRead(n.id);
      setShowNotifs(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept invitation');
    }
  };

  const handleRejectInvite = async (e, n) => {
    e.stopPropagation();
    if (!n.link) return;
    const token = n.link.split('/invite/')[1];
    if (!token) return;

    try {
      await workspacesApi.rejectInvite(token);
      toast.success('Invitation rejected');
      handleMarkRead(n.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject invitation');
    }
  };

  return (
    <header className="sticky top-0 z-20 h-14 bg-[var(--bg-primary)] border-b border-[var(--border)] flex items-center justify-between px-6 gap-4">
      {/* Search hint */}
      <button
        id="topbar-search"
        onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true }))}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-muted)] text-sm hover:border-brand-400 transition-all duration-150 group"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline ml-2">⌘K</kbd>
      </button>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            id="topbar-notifications"
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative btn-icon"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-brand-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-full mt-2 w-80 card shadow-2xl z-50 animate-slide-up overflow-hidden border border-[var(--border)]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <h3 className="font-semibold text-sm text-[var(--text-primary)]">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-xs text-brand-500 hover:text-brand-600 font-medium">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)]">
                    <Bell className="w-8 h-8 mb-2 opacity-30" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id}
                      onClick={() => { handleMarkRead(n.id); if (n.link && n.type !== 'INVITATION') router.push(n.link); setShowNotifs(false); }}
                      className={clsx(
                        'w-full text-left px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors border-b border-[var(--border-subtle)] last:border-0 cursor-pointer',
                        !n.isRead && 'bg-brand-50 dark:bg-brand-900/10'
                      )}>
                      <div className="flex items-start gap-3">
                        {!n.isRead && <div className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0" />}
                        <div className={clsx('flex-1 min-w-0', n.isRead && 'pl-5')}>
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{n.title}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">{format(new Date(n.createdAt), 'MMM d, h:mm a')}</p>
                          
                          {n.type === 'INVITATION' && (
                            <div className="flex items-center gap-2 mt-2">
                              <button onClick={(e) => handleAcceptInvite(e, n)} className="btn-primary btn-sm flex-1 py-1 px-2 text-xs">Accept</button>
                              <button onClick={(e) => handleRejectInvite(e, n)} className="btn-secondary btn-sm flex-1 py-1 px-2 text-xs">Reject</button>
                            </div>
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

        {/* Theme toggle */}
        {mounted && (
          <button id="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="btn-icon">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
      </div>
    </header>
  );
}
