'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useSocketStore } from '@/store/socketStore';
import { io } from 'socket.io-client';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import CommandPalette from '@/components/layout/CommandPalette';

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated, refreshAuth, accessToken } = useAuthStore();
  const { fetchWorkspaces, currentWorkspace } = useWorkspaceStore();
  const { setSocket, setConnected, setOnlineMembers, addOnlineMember, removeOnlineMember } = useSocketStore();
  const socketRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      if (!isAuthenticated) {
        const ok = await refreshAuth();
        if (!ok) { router.push('/auth/login'); return; }
      }
      fetchWorkspaces();
    };
    init();
  }, []);

  // Setup Socket.io
  useEffect(() => {
    const token = typeof window !== 'undefined' ? window.__accessToken : null;
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      setSocket(socket);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('workspace:online_members', (members) => setOnlineMembers(members));
    socket.on('user:offline', (userId) => removeOnlineMember(userId));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [accessToken]);

  // Join workspace room when workspace changes
  useEffect(() => {
    if (currentWorkspace && socketRef.current) {
      socketRef.current.emit('join:workspace', currentWorkspace.id);
    }
  }, [currentWorkspace?.id]);

  if (!isAuthenticated) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[var(--text-muted)] text-sm">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
