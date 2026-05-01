'use client';
import { format, isPast } from 'date-fns';
import { Target, Calendar, User, Trash2, ChevronRight, MoreHorizontal } from 'lucide-react';
import Image from 'next/image';
import clsx from 'clsx';
import { useState } from 'react';

const STATUS_CONFIG = {
  NOT_STARTED: { label: 'Not Started', cls: 'status-not-started' },
  IN_PROGRESS: { label: 'In Progress', cls: 'status-in-progress' },
  COMPLETED: { label: 'Completed', cls: 'status-completed' },
  ON_HOLD: { label: 'On Hold', cls: 'status-on-hold' },
  CANCELLED: { label: 'Cancelled', cls: 'status-cancelled' },
};

export default function GoalCard({ goal, onClick, onDelete, workspaceRole }) {
  const [showMenu, setShowMenu] = useState(false);
  const status = STATUS_CONFIG[goal.status] || STATUS_CONFIG.NOT_STARTED;
  const isOverdue = goal.dueDate && isPast(new Date(goal.dueDate)) && goal.status !== 'COMPLETED';

  const avgProgress = goal.milestones?.length > 0
    ? Math.round(goal.milestones.reduce((acc, m) => acc + m.progress, 0) / goal.milestones.length)
    : goal.status === 'COMPLETED' ? 100 : 0;

  return (
    <div
      id={`goal-card-${goal.id}`}
      className="card-hover group animate-fade-in relative"
      onClick={onClick}
    >
      {/* Status badge */}
      <div className="flex items-start justify-between mb-3">
        <span className={clsx('badge', status.cls)}>{status.label}</span>
        {(workspaceRole === 'ADMIN' || workspaceRole === 'MEMBER') && (
          <div className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="btn-icon opacity-0 group-hover:opacity-100 transition-opacity p-1"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 card shadow-lg z-10 w-32 py-1 border border-[var(--border)]">
                <button
                  onClick={() => { onDelete(goal.id); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-[var(--text-primary)] mb-1 line-clamp-2 group-hover:text-brand-500 transition-colors">
        {goal.title}
      </h3>
      {goal.description && (
        <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-3">{goal.description}</p>
      )}

      {/* Progress */}
      {goal.milestones?.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-1">
            <span>{goal.milestones.length} milestone{goal.milestones.length !== 1 ? 's' : ''}</span>
            <span className="font-medium text-brand-500">{avgProgress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${avgProgress}%` }} />
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-3">
        <div className="flex items-center gap-2">
          {goal.owner?.avatarUrl ? (
            <Image src={goal.owner.avatarUrl} alt={goal.owner.name} width={20} height={20} className="avatar w-5 h-5" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">
              {goal.owner?.name?.[0] || '?'}
            </div>
          )}
          <span className="truncate max-w-24">{goal.owner?.name || 'Unknown'}</span>
        </div>
        {goal.dueDate && (
          <div className={clsx('flex items-center gap-1', isOverdue ? 'text-red-500' : '')}>
            <Calendar className="w-3 h-3" />
            <span>{format(new Date(goal.dueDate), 'MMM d')}</span>
          </div>
        )}
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
        <span>{goal._count?.actionItems || 0} actions</span>
        <span>{goal._count?.comments || 0} comments</span>
        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
