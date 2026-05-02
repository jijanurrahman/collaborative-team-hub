'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSocketStore } from '@/store/socketStore';
import {
  LayoutDashboard, Target, Megaphone, CheckSquare, BarChart2,
  Settings, LogOut, Plus, ChevronDown, ChevronRight, Users,
  Shield, Layers, Bell
} from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { href: '/dashboard/goals', icon: Target, label: 'Goals' },
  { href: '/dashboard/announcements', icon: Megaphone, label: 'Announcements' },
  { href: '/dashboard/action-items', icon: CheckSquare, label: 'Action Items' },
  { href: '/dashboard/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/dashboard/audit', icon: Shield, label: 'Audit Log' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const { onlineMembers, isConnected } = useSocketStore();
  const [wsOpen, setWsOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const isActive = (href, exact) => {
    if (exact) return pathname === href;
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <aside className="sidebar shadow-2xl" style={{ background: 'var(--sidebar-bg)' }}>
      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:shadow-brand-500/40 transition-shadow">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg">Team Hub</span>
        </Link>
      </div>

      {/* Workspace Switcher */}
      <div className="px-2 py-3 border-b border-white/10">
        <button
          id="workspace-switcher"
          onClick={() => setWsOpen(!wsOpen)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-all duration-150 group"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-inner flex-shrink-0"
            style={{ background: currentWorkspace?.accentColor || '#6366f1' }}>
            {currentWorkspace?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-white text-sm font-medium truncate">{currentWorkspace?.name || 'Select workspace'}</p>
            <p className="text-white/40 text-xs">{currentWorkspace?.role || ''}</p>
          </div>
          <ChevronDown className={clsx('w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200', wsOpen && 'rotate-180')} />
        </button>

        {wsOpen && (
          <div className="mt-1 space-y-1 animate-slide-up">
            {workspaces.map((ws) => (
              <button key={ws.id}
                onClick={() => { setCurrentWorkspace(ws); setWsOpen(false); }}
                className={clsx('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
                  currentWorkspace?.id === ws.id ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
                )}>
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: ws.accentColor || '#6366f1' }}>
                  {ws.name[0].toUpperCase()}
                </div>
                <span className="truncate flex-1 text-left">{ws.name}</span>
                {currentWorkspace?.id === ws.id && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
              </button>
            ))}
            <Link href="/dashboard/workspaces/new"
              onClick={() => setWsOpen(false)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-brand-400 hover:bg-white/10 transition-all duration-150">
              <Plus className="w-4 h-4" /> New Workspace
            </Link>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-hidden">
        <div className="px-2 space-y-0.5">
          {navItems.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact);
            const targetHref = currentWorkspace
              ? href.replace('/dashboard', `/dashboard`)
              : href;
            return (
              <Link key={href} href={targetHref}
                className={clsx('sidebar-item', active && 'sidebar-item-active')}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>

        {/* Online Members */}
        {currentWorkspace && (
          <div className="px-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className={clsx('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-green-400' : 'bg-slate-500')} />
              <p className="text-white/30 text-xs font-medium uppercase tracking-wider">Online</p>
              <span className="text-white/30 text-xs">({onlineMembers.length})</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {currentWorkspace?.members?.filter(m => onlineMembers.includes(m.user.id)).slice(0, 8).map((m) => (
                <div key={m.user.id} className="avatar-online" title={m.user.name}>
                  {m.user.avatarUrl ? (
                    <Image src={m.user.avatarUrl} alt={m.user.name} width={28} height={28} className="avatar w-7 h-7" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                      {m.user.name[0]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Bottom: user + settings */}
      <div className="px-2 py-3 border-t border-white/10">
        <Link href="/dashboard/settings" className="sidebar-item">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
        <button id="sidebar-logout" onClick={handleLogout} className="sidebar-item w-full text-red-400 hover:bg-red-500/10 hover:text-red-300">
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 px-3 py-2 mt-1">
          {user?.avatarUrl ? (
            <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="avatar w-8 h-8" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-white/40 text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
