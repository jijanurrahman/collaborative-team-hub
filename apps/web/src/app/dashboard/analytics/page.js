'use client';
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { analyticsApi } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Download, Target, CheckSquare, AlertTriangle, Users } from 'lucide-react';
import toast from 'react-hot-toast';

import { useSocketStore } from '@/store/socketStore';

export default function AnalyticsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    
    const fetchAnalytics = async () => {
      try {
        const res = await analyticsApi.get(currentWorkspace.id);
        setData(res.data);
      } catch (err) {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();

    const socket = useSocketStore.getState().socket;
    if (socket) {
      socket.on('goal:created', fetchAnalytics);
      socket.on('goal:updated', fetchAnalytics);
      socket.on('goal:deleted', fetchAnalytics);
      socket.on('action_item:created', fetchAnalytics);
      socket.on('action_item:updated', fetchAnalytics);
      socket.on('action_item:deleted', fetchAnalytics);
      socket.on('workspace:member_joined', fetchAnalytics);
      socket.on('workspace:member_removed', fetchAnalytics);

      return () => {
        socket.off('goal:created', fetchAnalytics);
        socket.off('goal:updated', fetchAnalytics);
        socket.off('goal:deleted', fetchAnalytics);
        socket.off('action_item:created', fetchAnalytics);
        socket.off('action_item:updated', fetchAnalytics);
        socket.off('action_item:deleted', fetchAnalytics);
        socket.off('workspace:member_joined', fetchAnalytics);
        socket.off('workspace:member_removed', fetchAnalytics);
      };
    }
  }, [currentWorkspace?.id]);

  const handleExport = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const res = await analyticsApi.export(currentWorkspace.id);
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${currentWorkspace.slug}-export.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success('Export started');
    } catch (err) {
      toast.error('Failed to export data');
    }
  };

  if (!currentWorkspace) return null;

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const { stats, chartData } = data;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="text-[var(--text-muted)] mt-1">Overview of your workspace performance</p>
        </div>
        <button onClick={handleExport} className="btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 border border-[var(--border)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Total Goals</p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalGoals}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            {stats.completedGoals} completed ({stats.completionRate}%)
          </p>
        </div>

        <div className="card p-5 border border-[var(--border)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Items Completed This Week</p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{stats.completedThisWeek}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500">
              <CheckSquare className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            Out of {stats.totalItems} total action items
          </p>
        </div>

        <div className="card p-5 border border-[var(--border)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Overdue Count</p>
              <h3 className="text-2xl font-bold text-red-500">{stats.overdueGoals + stats.overdueItems}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-4">
            {stats.overdueGoals} goals, {stats.overdueItems} items
          </p>
        </div>

        <div className="card p-5 border border-[var(--border)]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">Workspace Members</p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalMembers}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6 border border-[var(--border)]">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Goal Completion Trend</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="week" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="created" name="Created Goals" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="completed" name="Completed Goals" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
