'use client';
import { useState } from 'react';
import { X } from 'lucide-react';

const STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED'];

export default function GoalModal({ workspaceId, members, onSubmit, onClose, initial }) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    status: initial?.status || 'NOT_STARTED',
    dueDate: initial?.dueDate ? initial.dueDate.slice(0, 10) : '',
    ownerId: initial?.ownerId || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, workspaceId });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text-primary)]">{initial ? 'Edit Goal' : 'Create Goal'}</h2>
          <button onClick={onClose} className="btn-icon"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Title *</label>
            <input id="goal-title" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Launch Q3 feature" required />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none h-24" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What does success look like?" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Status</label>
              <select id="goal-status" className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Due Date</label>
              <input id="goal-due" type="date" className="input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Owner</label>
            <select id="goal-owner" className="input" value={form.ownerId} onChange={e => setForm({ ...form, ownerId: e.target.value })}>
              <option value="">Select owner...</option>
              {members.map(m => (
                <option key={m.user?.id || m.userId} value={m.user?.id || m.userId}>{m.user?.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button id="goal-submit" type="submit" className="btn-primary">{initial ? 'Update' : 'Create Goal'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
