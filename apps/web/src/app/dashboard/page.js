'use client';
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { analyticsApi } from '@/lib/api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Target, CheckCircle, AlertTriangle, Users, TrendingUp, Zap, Clock } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];

const StatCard = ({ icon: Icon, label, value, sub, color, trend }) => (
  <div className="card hover:shadow-lg transition-all duration-200 group">
    <div className="flex items-start justify-between mb-4">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10 group-hover:scale-110 transition-transform duration-200`}>
        <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      {trend !== undefined && (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <p className="text-3xl font-bold text-[var(--text-primary)] mb-1">{value}</p>
    <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
    {sub && <p className="text-xs text-[var(--text-muted)] mt-0.5">{sub}</p>}
  </div>
);

export default function DashboardPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await analyticsApi.get(currentWorkspace.id);
        setAnalytics(data);
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, [currentWorkspace?.id]);

  if (!currentWorkspace) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
      <div className="text-6xl">🏠</div>
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">No workspace selected</h2>
      <p className="text-[var(--text-secondary)] text-center max-w-md">Create or join a workspace to get started with Team Hub.</p>
      <Link href="/dashboard/workspaces/new" className="btn-primary">Create Workspace</Link>
    </div>
  );

  if (loading) return (
    <div className="p-8 space-y-6">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="skeleton h-72 rounded-xl" />
        <div className="skeleton h-72 rounded-xl" />
      </div>
    </div>
  );

  const { stats, goalsByStatus, itemsByStatus, chartData } = analytics || {};

  const statusPieData = goalsByStatus?.map((g, i) => ({
    name: g.status.replace(/_/g, ' '),
    value: g.count,
    color: COLORS[i % COLORS.length],
  })) || [];

  return (
    <div className="p-6 lg:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {currentWorkspace.name} · Last updated {format(new Date(), 'MMM d, h:mm a')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={async () => {
              try {
                const { workspacesApi } = await import('@/lib/api');
                const res = await workspacesApi.export(currentWorkspace.id);
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const a = document.createElement('a');
                a.href = url;
                a.download = `workspace-${currentWorkspace.id}-export.csv`;
                a.click();
              } catch (e) {
                console.error(e);
                import('react-hot-toast').then(t => t.default.error('Export failed'));
              }
            }}
            className="btn-secondary btn-sm"
          >
            <Clock className="w-4 h-4" /> Export CSV
          </button>
          <Link href="/dashboard/goals" className="btn-primary btn-sm">
            <Target className="w-4 h-4" /> View Goals
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Total Goals" value={stats?.totalGoals || 0} sub={`${stats?.completionRate || 0}% completion rate`} color="bg-brand-500" trend={5} />
        <StatCard icon={CheckCircle} label="Completed This Week" value={stats?.completedThisWeek || 0} sub="Action items done" color="bg-green-500" trend={12} />
        <StatCard icon={AlertTriangle} label="Overdue Items" value={stats?.overdueItems || 0} sub={`${stats?.overdueGoals || 0} overdue goals`} color="bg-red-500" trend={-3} />
        <StatCard icon={Users} label="Team Members" value={stats?.totalMembers || 0} sub="Active in workspace" color="bg-blue-500" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Goal Completion Chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-500" /> Goal Activity (8 weeks)
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData || []} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="completed" stroke="#6366f1" strokeWidth={2} fill="url(#colorCompleted)" name="Completed" />
              <Area type="monotone" dataKey="created" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorCreated)" name="Created" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Goal Status Pie */}
        <div className="card">
          <h3 className="font-semibold text-[var(--text-primary)] mb-6 flex items-center gap-2">
            <Zap className="w-4 h-4 text-brand-500" /> Goal Status
          </h3>
          {statusPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {statusPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                      <span className="text-[var(--text-secondary)] capitalize">{item.name.toLowerCase()}</span>
                    </div>
                    <span className="font-medium text-[var(--text-primary)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-[var(--text-muted)]">
              <Target className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No goals yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Items by Status */}
      <div className="card">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-500" /> Action Items by Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { status: 'TODO', label: 'To Do', color: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-600 dark:text-slate-300' },
            { status: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
            { status: 'IN_REVIEW', label: 'In Review', color: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
            { status: 'DONE', label: 'Done', color: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
          ].map(({ status, label, color, text }) => {
            const count = itemsByStatus?.find(i => i.status === status)?.count || 0;
            return (
              <div key={status} className={`${color} rounded-xl p-4`}>
                <p className={`text-2xl font-bold ${text}`}>{count}</p>
                <p className={`text-sm font-medium ${text} opacity-80`}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
