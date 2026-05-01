'use client';
import { useState, useEffect, useCallback } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { actionItemsApi, goalsApi } from '@/lib/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, CheckSquare, List, Columns, AlertTriangle, Calendar, User, Tag } from 'lucide-react';
import { format, isPast } from 'date-fns';
import Image from 'next/image';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const COLUMNS = [
  { id: 'TODO', label: 'To Do', color: 'bg-slate-200 dark:bg-slate-700' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-200 dark:bg-blue-900/40' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-yellow-200 dark:bg-yellow-900/40' },
  { id: 'DONE', label: 'Done', color: 'bg-green-200 dark:bg-green-900/40' },
];

const PRIORITY_CONFIG = {
  URGENT: { label: 'Urgent', cls: 'badge-red', dot: 'bg-red-500' },
  HIGH: { label: 'High', cls: 'badge-yellow', dot: 'bg-orange-500' },
  MEDIUM: { label: 'Medium', cls: 'badge-blue', dot: 'bg-blue-500' },
  LOW: { label: 'Low', cls: 'badge-gray', dot: 'bg-slate-400' },
};

function ActionItemCard({ item, index, onClick }) {
  const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.MEDIUM;
  const isOverdue = item.dueDate && isPast(new Date(item.dueDate)) && item.status !== 'DONE';

  return (
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={clsx(
            'kanban-card mb-2 group',
            snapshot.isDragging && 'shadow-2xl rotate-1 scale-105 opacity-90'
          )}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className={clsx('badge', priority.cls)}>{priority.label}</span>
            {isOverdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
          </div>

          <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 mb-2">{item.title}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {item.assignee ? (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold" title={item.assignee.name}>
                  {item.assignee.name[0]}
                </div>
              ) : (
                <User className="w-4 h-4 text-[var(--text-muted)]" />
              )}
            </div>
            {item.dueDate && (
              <div className={clsx('flex items-center gap-1 text-xs', isOverdue ? 'text-red-500' : 'text-[var(--text-muted)]')}>
                <Calendar className="w-3 h-3" />
                {format(new Date(item.dueDate), 'MMM d')}
              </div>
            )}
          </div>

          {item.goal && (
            <div className="mt-2 flex items-center gap-1 text-xs text-[var(--text-muted)]">
              <Tag className="w-3 h-3" />
              <span className="truncate">{item.goal.title}</span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

export default function ActionItemsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { socket } = useSocketStore();
  const [items, setItems] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '', goalId: '', dueDate: '' });

  const fetchItems = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const [itemsRes, goalsRes] = await Promise.all([
        actionItemsApi.list(currentWorkspace.id),
        goalsApi.list(currentWorkspace.id),
      ]);
      setItems(itemsRes.data.items);
      setGoals(goalsRes.data.goals);
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!socket) return;
    const onCreated = (i) => setItems(prev => [i, ...prev]);
    const onUpdated = (i) => setItems(prev => prev.map(x => x.id === i.id ? { ...x, ...i } : x));
    const onDeleted = ({ id }) => setItems(prev => prev.filter(x => x.id !== id));
    socket.on('action_item:created', onCreated);
    socket.on('action_item:updated', onUpdated);
    socket.on('action_item:deleted', onDeleted);
    return () => {
      socket.off('action_item:created', onCreated);
      socket.off('action_item:updated', onUpdated);
      socket.off('action_item:deleted', onDeleted);
    };
  }, [socket]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, ...form, creator: user, createdAt: new Date().toISOString() };
    setItems(prev => [optimistic, ...prev]);
    setShowCreateModal(false);
    setForm({ title: '', description: '', priority: 'MEDIUM', status: 'TODO', assigneeId: '', goalId: '', dueDate: '' });
    try {
      const { data } = await actionItemsApi.create({ ...form, workspaceId: currentWorkspace.id, assigneeId: form.assigneeId || null, goalId: form.goalId || null, dueDate: form.dueDate || null });
      setItems(prev => prev.map(i => i.id === tempId ? data.item : i));
      toast.success('Action item created!');
    } catch (err) {
      setItems(prev => prev.filter(i => i.id !== tempId));
      toast.error(err.response?.data?.error || 'Failed to create action item');
    }
  };

  const handleDragEnd = useCallback(async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;
    const item = items.find(i => i.id === draggableId);
    if (!item || item.status === newStatus) return;

    // Optimistic update
    setItems(prev => prev.map(i => i.id === draggableId ? { ...i, status: newStatus } : i));
    try {
      await actionItemsApi.update(draggableId, { status: newStatus });
    } catch (_) {
      setItems(prev => prev.map(i => i.id === draggableId ? { ...i, status: item.status } : i));
      toast.error('Failed to update status');
    }
  }, [items]);

  const getColumnItems = (status) => items.filter(i => i.status === status);

  if (!currentWorkspace) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)]"><p>Select a workspace</p></div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pb-4 border-b border-[var(--border)]">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-500" /> Action Items
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{items.length} items · {getColumnItems('DONE').length} done</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-[var(--border)] rounded-lg overflow-hidden">
            <button id="view-kanban" onClick={() => setViewMode('kanban')} className={clsx('p-2 transition-colors', viewMode === 'kanban' ? 'bg-brand-500 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]')}>
              <Columns className="w-4 h-4" />
            </button>
            <button id="view-list" onClick={() => setViewMode('list')} className={clsx('p-2 transition-colors', viewMode === 'list' ? 'bg-brand-500 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-secondary)]')}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button id="create-action-btn" onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Item
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      {viewMode === 'kanban' ? (
        <div className="flex-1 overflow-x-auto p-6">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max h-full">
              {COLUMNS.map(col => (
                <div key={col.id} className="kanban-col flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={clsx('w-2.5 h-2.5 rounded-full', col.color)} />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{col.label}</h3>
                    </div>
                    <span className="badge badge-gray">{getColumnItems(col.id).length}</span>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={clsx('min-h-24 transition-colors rounded-lg', snapshot.isDraggingOver && 'bg-brand-50 dark:bg-brand-900/10 ring-2 ring-brand-300 dark:ring-brand-700')}
                      >
                        {getColumnItems(col.id).map((item, idx) => (
                          <ActionItemCard key={item.id} item={item} index={idx} onClick={() => {}} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      ) : (
        /* List View */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-2">
            {items.map(item => {
              const priority = PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.MEDIUM;
              const isOverdue = item.dueDate && isPast(new Date(item.dueDate)) && item.status !== 'DONE';
              return (
                <div key={item.id} className="card-hover flex items-center gap-4">
                  <div className={clsx('w-2 h-2 rounded-full flex-shrink-0', priority.dot)} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-sm font-medium text-[var(--text-primary)]', item.status === 'DONE' && 'line-through text-[var(--text-muted)]')}>{item.title}</p>
                    {item.goal && <p className="text-xs text-[var(--text-muted)] truncate">↳ {item.goal.title}</p>}
                  </div>
                  <span className={clsx('badge', priority.cls)}>{priority.label}</span>
                  {item.assignee && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" title={item.assignee.name}>
                      {item.assignee.name[0]}
                    </div>
                  )}
                  {item.dueDate && (
                    <span className={clsx('text-xs flex-shrink-0', isOverdue ? 'text-red-500' : 'text-[var(--text-muted)]')}>
                      {format(new Date(item.dueDate), 'MMM d')}
                    </span>
                  )}
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0 hidden md:inline">{item.status.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-primary)]">Create Action Item</h2>
              <button onClick={() => setShowCreateModal(false)} className="btn-icon"><CheckSquare className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="label">Title *</label>
                <input id="action-title" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What needs to be done?" required />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input resize-none h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Priority</label>
                  <select id="action-priority" className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select id="action-status" className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Assignee</label>
                  <select id="action-assignee" className="input" value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {currentWorkspace?.members?.map(m => (
                      <option key={m.user?.id} value={m.user?.id}>{m.user?.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input id="action-due" type="date" className="input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Link to Goal</label>
                <select id="action-goal" className="input" value={form.goalId} onChange={e => setForm({ ...form, goalId: e.target.value })}>
                  <option value="">None</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary">Cancel</button>
                <button id="action-submit" type="submit" className="btn-primary">Create Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
