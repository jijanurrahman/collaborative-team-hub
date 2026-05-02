'use client';
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSocketStore } from '@/store/socketStore';
import { goalsApi } from '@/lib/api';
import GoalCard from '@/components/goals/GoalCard';
import GoalModal from '@/components/goals/GoalModal';
import GoalDetail from '@/components/goals/GoalDetail';
import { Plus, Target, Filter, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const STATUSES = ['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];

export default function GoalsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const { socket } = useSocketStore();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchGoals = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const { data } = await goalsApi.list(currentWorkspace.id);
      setGoals(data.goals);
    } catch (err) {
      toast.error('Failed to load goals');
    }
    setLoading(false);
  };

  useEffect(() => { fetchGoals(); }, [currentWorkspace?.id]);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;
    const onCreated = (g) => setGoals(prev => [g, ...prev]);
    const onUpdated = (g) => setGoals(prev => prev.map(item => item.id === g.id ? { ...item, ...g } : item));
    const onDeleted = ({ id }) => setGoals(prev => prev.filter(g => g.id !== id));
    
    // Listen for related entity updates to update counts
    const onActionItemCreated = (item) => {
      if (item.goalId) {
        setGoals(prev => prev.map(g => g.id === item.goalId ? { ...g, _count: { ...g._count, actionItems: (g._count?.actionItems || 0) + 1 } } : g));
      }
    };
    const onActionItemDeleted = ({ id, goalId }) => {
      if (goalId) {
        setGoals(prev => prev.map(g => g.id === goalId ? { ...g, _count: { ...g._count, actionItems: Math.max(0, (g._count?.actionItems || 1) - 1) } } : g));
      }
    };
    const onProgressUpdate = ({ goalId }) => {
      setGoals(prev => prev.map(g => g.id === goalId ? { ...g, _count: { ...g._count, progressUpdates: (g._count?.progressUpdates || 0) + 1 } } : g));
    };

    socket.on('goal:created', onCreated);
    socket.on('goal:updated', onUpdated);
    socket.on('goal:deleted', onDeleted);
    socket.on('action_item:created', onActionItemCreated);
    socket.on('action_item:deleted', onActionItemDeleted);
    socket.on('goal:progress_update', onProgressUpdate);

    return () => { 
      socket.off('goal:created', onCreated); 
      socket.off('goal:updated', onUpdated); 
      socket.off('goal:deleted', onDeleted); 
      socket.off('action_item:created', onActionItemCreated);
      socket.off('action_item:deleted', onActionItemDeleted);
      socket.off('goal:progress_update', onProgressUpdate);
    };
  }, [socket]);

  const handleCreate = async (data) => {
    // Optimistic UI: add placeholder immediately
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, ...data, owner: currentWorkspace?.members?.find(m => m.userId === data.ownerId)?.user, milestones: [], _count: { actionItems: 0, comments: 0 }, createdAt: new Date().toISOString() };
    setGoals(prev => [optimistic, ...prev]);
    setShowModal(false);

    try {
      const { data: res } = await goalsApi.create({ ...data, workspaceId: currentWorkspace.id });
      setGoals(prev => prev.map(g => g.id === tempId ? res.goal : g));
      toast.success('Goal created!');
    } catch (err) {
      setGoals(prev => prev.filter(g => g.id !== tempId)); // rollback
      toast.error(err.response?.data?.error || 'Failed to create goal');
    }
  };

  const handleDelete = async (id) => {
    const backup = goals.find(g => g.id === id);
    setGoals(prev => prev.filter(g => g.id !== id)); // optimistic
    try {
      await goalsApi.delete(id);
      toast.success('Goal deleted');
      if (selectedGoal?.id === id) setSelectedGoal(null);
    } catch (err) {
      setGoals(prev => [backup, ...prev]); // rollback
      toast.error('Failed to delete goal');
    }
  };

  const filtered = goals.filter(g => {
    const matchStatus = filterStatus === 'ALL' || g.status === filterStatus;
    const matchSearch = !search || g.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (!currentWorkspace) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
      <p>Select a workspace to view goals</p>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Main */}
      <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Target className="w-6 h-6 text-brand-500" /> Goals
            </h1>
            <p className="text-[var(--text-muted)] text-sm mt-0.5">{filtered.length} goals in {currentWorkspace.name}</p>
          </div>
          <button id="create-goal-btn" onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> New Goal
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search goals..." className="input pl-9" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                  filterStatus === s ? 'bg-brand-500 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                )}>
                {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Goals Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
            <Target className="w-16 h-16 mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-[var(--text-secondary)] mb-1">No goals yet</h3>
            <p className="text-sm mb-4">Create your first goal to get started</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Create Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(goal => (
              <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedGoal(goal)}
                onDelete={handleDelete} workspaceRole={currentWorkspace.role} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedGoal && (
        <GoalDetail
          goalId={selectedGoal.id}
          onClose={() => setSelectedGoal(null)}
          onUpdate={(updated) => setGoals(prev => prev.map(g => g.id === updated.id ? { ...g, ...updated } : g))}
          workspaceId={currentWorkspace.id}
          workspaceRole={currentWorkspace.role}
        />
      )}

      {/* Create Modal */}
      {showModal && (
        <GoalModal
          workspaceId={currentWorkspace.id}
          members={currentWorkspace.members || []}
          onSubmit={handleCreate}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
