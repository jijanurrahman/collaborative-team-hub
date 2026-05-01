'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { Layers } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewWorkspacePage() {
  const router = useRouter();
  const { createWorkspace } = useWorkspaceStore();
  const [form, setForm] = useState({ name: '', description: '', accentColor: '#6366f1' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await createWorkspace(form);
    if (result.success) {
      toast.success('Workspace created!');
      router.push('/dashboard');
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-6 card shadow-xl animate-fade-in border-2 border-brand-100 dark:border-brand-900">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 mb-3 shadow-lg">
          <Layers className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create Workspace</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Set up a new collaborative environment</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Workspace Name *</label>
          <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engineering Team" required />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none h-20" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What is this workspace for?" />
        </div>
        <div>
          <label className="label">Brand Color</label>
          <div className="flex items-center gap-3">
            <input type="color" value={form.accentColor} onChange={e => setForm({ ...form, accentColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
            <span className="text-sm font-mono text-[var(--text-muted)]">{form.accentColor}</span>
          </div>
        </div>
        
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
