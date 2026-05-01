'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { workspacesApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import toast from 'react-hot-toast';

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const { fetchWorkspaces } = useWorkspaceStore();
  const [status, setStatus] = useState('loading'); // loading, success, error

  useEffect(() => {
    if (!isAuthenticated) {
      // Store intended destination then login
      sessionStorage.setItem('redirectAfterLogin', `/invite/${params.token}`);
      router.push('/auth/login');
      return;
    }

    const acceptInvite = async () => {
      try {
        await workspacesApi.acceptInvite(params.token);
        await fetchWorkspaces(); // Refresh workspaces
        setStatus('success');
        toast.success('Successfully joined workspace!');
        setTimeout(() => router.push('/dashboard'), 2000);
      } catch (err) {
        setStatus('error');
        toast.error(err.response?.data?.error || 'Invalid or expired invitation');
      }
    };

    acceptInvite();
  }, [params.token, isAuthenticated, router, fetchWorkspaces]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
      <div className="card w-full max-w-md text-center p-8 animate-fade-in shadow-xl">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Processing Invitation...</h2>
            <p className="text-[var(--text-muted)]">Please wait while we add you to the workspace.</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4 text-green-500">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Invitation Accepted!</h2>
            <p className="text-[var(--text-muted)]">Redirecting to your dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 text-red-500">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">Invitation Failed</h2>
            <p className="text-[var(--text-muted)]">This link may be invalid, expired, or meant for a different account.</p>
            <button onClick={() => router.push('/dashboard')} className="btn-primary mt-4">Go to Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
