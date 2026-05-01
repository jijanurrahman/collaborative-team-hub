'use client';
import { useState, useEffect, useRef } from 'react';
import { goalsApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { X, Plus, Send, Target, CheckCircle, Circle, Edit3, Save, Users } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUS_OPTIONS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];

export default function GoalDetail({ goalId, onClose, onUpdate, workspaceId, workspaceRole }) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progressText, setProgressText] = useState('');
  const [commentText, setCommentText] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState('');
  const [liveCursors, setLiveCursors] = useState([]);
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const descRef = useRef(null);

  useEffect(() => {
    const fetchGoal = async () => {
      setLoading(true);
      try {
        const { data } = await goalsApi.get(goalId);
        setGoal(data.goal);
        setDescValue(data.goal.description || '');
      } catch (_) { toast.error('Failed to load goal'); }
      setLoading(false);
    };
    fetchGoal();
  }, [goalId]);

  // Collaborative editing via socket
  useEffect(() => {
    if (!socket || !goal) return;
    const onEdit = ({ goalId: gId, content, cursor, userId: uid, socketId }) => {
      if (gId !== goalId || uid === user?.id) return;
      setDescValue(content);
      setLiveCursors(prev => {
        const filtered = prev.filter(c => c.socketId !== socketId);
        return [...filtered, { socketId, userId: uid, cursor }];
      });
    };
    socket.on('goal:edit', onEdit);
    return () => socket.off('goal:edit', onEdit);
  }, [socket, goalId, user?.id]);

  const handleDescChange = (e) => {
    const content = e.target.value;
    setDescValue(content);
    socket?.emit('goal:edit', { workspaceId, goalId, content, cursor: e.target.selectionStart });
  };

  const handleSaveDesc = async () => {
    try {
      const { data } = await goalsApi.update(goalId, { description: descValue });
      setGoal(g => ({ ...g, description: data.goal.description }));
      onUpdate?.(data.goal);
      setEditingDesc(false);
      toast.success('Description updated');
    } catch (_) { toast.error('Failed to save'); }
  };

  const handleStatusChange = async (status) => {
    try {
      const { data } = await goalsApi.update(goalId, { status });
      setGoal(g => ({ ...g, status }));
      onUpdate?.(data.goal);
      toast.success('Status updated');
    } catch (_) { toast.error('Failed to update status'); }
  };

  const handlePostProgress = async (e) => {
    e.preventDefault();
    if (!progressText.trim()) return;
    try {
      const { data } = await goalsApi.addProgress(goalId, progressText);
      setGoal(g => ({ ...g, progressUpdates: [data.update, ...(g.progressUpdates || [])] }));
      setProgressText('');
      toast.success('Progress update posted');
    } catch (_) { toast.error('Failed to post update'); }
  };

  const handleAddMilestone = async () => {
    const title = prompt('Milestone title:');
    if (!title) return;
    try {
      const { data } = await goalsApi.createMilestone(goalId, { title });
      setGoal(g => ({ ...g, milestones: [...(g.milestones || []), data.milestone] }));
      toast.success('Milestone added');
    } catch (_) { toast.error('Failed to add milestone'); }
  };

  const handleMilestoneProgress = async (milestoneId, progress) => {
    try {
      const { data } = await goalsApi.updateMilestone(goalId, milestoneId, { progress: parseInt(progress) });
      setGoal(g => ({ ...g, milestones: g.milestones.map(m => m.id === milestoneId ? data.milestone : m) }));
    } catch (_) {}
  };

  if (loading) return (
    <div className="w-[420px] border-l border-[var(--border)] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!goal) return null;

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] flex flex-col overflow-hidden animate-slide-in-right">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-[var(--border)] bg-[var(--bg-card)]">
        <div className="flex-1 min-w-0 pr-3">
          <h2 className="font-semibold text-[var(--text-primary)] line-clamp-2">{goal.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <select value={goal.status} onChange={e => handleStatusChange(e.target.value)}
              className="input py-1 text-xs w-auto"
              disabled={workspaceRole === 'VIEWER'}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </div>
        <button onClick={onClose} className="btn-icon flex-shrink-0"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Description (collaborative editing) */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Description</p>
            {liveCursors.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-brand-500">
                <Users className="w-3 h-3" />
                <span>{liveCursors.length} editing</span>
              </div>
            )}
            {workspaceRole !== 'VIEWER' && !editingDesc && (
              <button onClick={() => setEditingDesc(true)} className="btn-icon p-1">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {editingDesc ? (
            <div className="relative">
              <textarea
                ref={descRef}
                value={descValue}
                onChange={handleDescChange}
                className="input resize-none h-32 text-sm"
                placeholder="Describe this goal..."
              />
              {liveCursors.map(c => (
                <div key={c.socketId} className="absolute top-0 right-0 mt-1 mr-1">
                  <span className="bg-purple-500 text-white text-[10px] px-1 rounded">✏️ Editing</span>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <button onClick={handleSaveDesc} className="btn-primary btn-sm"><Save className="w-3.5 h-3.5" /> Save</button>
                <button onClick={() => setEditingDesc(false)} className="btn-secondary btn-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">{goal.description || <span className="italic text-[var(--text-muted)]">No description — click edit to add one</span>}</p>
          )}
        </div>

        {/* Milestones */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Milestones</p>
            {workspaceRole !== 'VIEWER' && (
              <button onClick={handleAddMilestone} className="btn-icon p-1"><Plus className="w-3.5 h-3.5" /></button>
            )}
          </div>
          {(!goal.milestones || goal.milestones.length === 0) ? (
            <p className="text-xs text-[var(--text-muted)] italic">No milestones yet</p>
          ) : (
            <div className="space-y-3">
              {goal.milestones.map(m => (
                <div key={m.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--text-primary)] truncate flex-1">{m.title}</span>
                    <span className="text-xs font-medium text-brand-500 ml-2">{m.progress}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={m.progress}
                    onChange={e => handleMilestoneProgress(m.id, e.target.value)}
                    className="w-full h-1.5 accent-brand-500"
                    disabled={workspaceRole === 'VIEWER'} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Progress Updates */}
        <div className="p-4 border-b border-[var(--border)]">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">Activity Feed</p>
          {workspaceRole !== 'VIEWER' && (
            <form onSubmit={handlePostProgress} className="flex gap-2 mb-4">
              <input
                value={progressText}
                onChange={e => setProgressText(e.target.value)}
                placeholder="Post a progress update..."
                className="input flex-1 text-sm py-2"
              />
              <button type="submit" className="btn-primary px-3 py-2"><Send className="w-4 h-4" /></button>
            </form>
          )}
          <div className="space-y-3">
            {(goal.progressUpdates || []).map(u => (
              <div key={u.id} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                  {u.user?.name?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--text-primary)]">{u.user?.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{format(new Date(u.createdAt), 'MMM d, h:mm a')}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{u.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comments */}
        <div className="p-4">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-3">Comments ({goal.comments?.length || 0})</p>
          <div className="space-y-3">
            {(goal.comments || []).map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {c.author?.name?.[0]}
                </div>
                <div className="flex-1 bg-[var(--bg-card)] rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">{c.author?.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{format(new Date(c.createdAt), 'MMM d')}</span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{c.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
