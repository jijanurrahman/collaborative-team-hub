'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Target, Megaphone, CheckSquare, BarChart2, Settings, LogOut, Home, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import clsx from 'clsx';

const commands = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: Home, action: (router) => router.push('/dashboard'), shortcut: 'G D' },
  { id: 'goals', label: 'Go to Goals', icon: Target, action: (router) => router.push('/dashboard/goals'), shortcut: 'G G' },
  { id: 'announcements', label: 'Go to Announcements', icon: Megaphone, action: (router) => router.push('/dashboard/announcements'), shortcut: 'G A' },
  { id: 'action-items', label: 'Go to Action Items', icon: CheckSquare, action: (router) => router.push('/dashboard/action-items'), shortcut: 'G I' },
  { id: 'analytics', label: 'Go to Analytics', icon: BarChart2, action: (router) => router.push('/dashboard/analytics'), shortcut: 'G N' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, action: (router) => router.push('/dashboard/settings'), shortcut: 'G S' },
  { id: 'new-goal', label: 'Create new goal', icon: Target, action: (router) => router.push('/dashboard/goals?new=1') },
  { id: 'new-announcement', label: 'Create announcement', icon: Megaphone, action: (router) => router.push('/dashboard/announcements?new=1') },
  { id: 'new-action', label: 'Create action item', icon: CheckSquare, action: (router) => router.push('/dashboard/action-items?new=1') },
  { id: 'invite', label: 'Invite team member', icon: Users, action: (router) => router.push('/dashboard/settings?tab=members') },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const { logout } = useAuthStore();
  const inputRef = useRef(null);

  const filtered = query
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setSelected(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => (s + 1) % filtered.length); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => (s - 1 + filtered.length) % filtered.length); }
    if (e.key === 'Enter' && filtered[selected]) {
      filtered[selected].action(router);
      setOpen(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            id="command-palette-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none text-sm"
          />
          <kbd className="flex-shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-[var(--text-muted)] text-sm py-8">No commands found</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                id={`cmd-${cmd.id}`}
                onClick={() => { cmd.action(router); setOpen(false); }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors text-sm',
                  i === selected ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400' : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                )}
              >
                <cmd.icon className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                <span className="flex-1">{cmd.label}</span>
                {cmd.shortcut && <kbd className="text-xs">{cmd.shortcut}</kbd>}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>↑↓ navigate</span>
          <span>⏎ select</span>
          <span>Esc close</span>
          <span className="ml-auto"><kbd>⌘K</kbd> toggle</span>
        </div>
      </div>
    </div>
  );
}
