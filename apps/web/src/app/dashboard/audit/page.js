'use client';
import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { auditApi } from '@/lib/api';
import { Shield, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';
import Image from 'next/image';
import clsx from 'clsx';

export default function AuditLogPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const { data } = await auditApi.list(currentWorkspace.id, {
          entityType: filterType || undefined,
          limit: 50,
          offset: page * 50,
        });
        setLogs(data.logs);
        setTotal(data.total);
      } catch (_) {}
      setLoading(false);
    };
    fetchLogs();
  }, [currentWorkspace?.id, filterType, page]);

  const handleExportCSV = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/${currentWorkspace.id}/export`, {
        headers: { Authorization: `Bearer ${window.__accessToken}` },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentWorkspace.slug}-export.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (_) {}
  };

  if (!currentWorkspace) return (
    <div className="flex items-center justify-center h-full text-[var(--text-muted)]"><p>Select a workspace</p></div>
  );

  if (currentWorkspace.role !== 'ADMIN' && currentWorkspace.role !== 'MEMBER') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
        <Shield className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium text-[var(--text-secondary)]">Access Denied</p>
        <p className="text-sm">You need higher permissions to view the audit log.</p>
      </div>
    );
  }

  const entityTypes = [...new Set(logs.map(l => l.entityType))];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-500" /> Audit Log
          </h1>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Immutable record of workspace activity ({total} events)</p>
        </div>
        {currentWorkspace.role === 'ADMIN' && (
          <button onClick={handleExportCSV} className="btn-secondary">
            <Download className="w-4 h-4" /> Export Data CSV
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }} className="input text-sm py-1.5 w-auto">
            <option value="">All Entities</option>
            {['WORKSPACE', 'MEMBER', 'GOAL', 'ANNOUNCEMENT', 'ACTION_ITEM'].map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)]">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">No activity found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Entity Type</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--bg-secondary)] transition-colors">
                    <td className="px-4 py-3 text-[var(--text-muted)]">{format(new Date(log.createdAt), 'MMM d, yyyy HH:mm:ss')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {log.user?.avatarUrl ? (
                          <Image src={log.user.avatarUrl} alt="" width={20} height={20} className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white text-[10px] font-bold">
                            {log.user?.name?.[0]}
                          </div>
                        )}
                        <span className="text-[var(--text-primary)]">{log.user?.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        log.action === 'CREATE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        log.action === 'DELETE' || log.action === 'REMOVE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      )}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{log.entityType}</td>
                    <td className="px-4 py-3 text-[var(--text-muted)] font-mono text-xs">
                      {JSON.stringify(log.metadata).length > 50 ? JSON.stringify(log.metadata).substring(0, 50) + '...' : JSON.stringify(log.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center text-sm text-[var(--text-muted)]">
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm disabled:opacity-50">Previous</button>
        <span>Page {page + 1}</span>
        <button disabled={logs.length < 50} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}
