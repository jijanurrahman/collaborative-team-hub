import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { workspacesApi } from '@/lib/api';

export const useWorkspaceStore = create(
  devtools(
    persist(
      (set, get) => ({
        workspaces: [],
        currentWorkspace: null,
        isLoading: false,
        error: null,

        fetchWorkspaces: async () => {
          set({ isLoading: true });
          try {
            const { data } = await workspacesApi.list();
            set({ workspaces: data.workspaces, isLoading: false });
            // Set current workspace if none selected
            if (!get().currentWorkspace && data.workspaces.length > 0) {
              set({ currentWorkspace: data.workspaces[0] });
            }
          } catch (err) {
            set({ error: err.response?.data?.error || 'Failed to load workspaces', isLoading: false });
          }
        },

        createWorkspace: async (data) => {
          try {
            const { data: res } = await workspacesApi.create(data);
            set((state) => ({ workspaces: [res.workspace, ...state.workspaces] }));
            set({ currentWorkspace: res.workspace });
            return { success: true, workspace: res.workspace };
          } catch (err) {
            return { success: false, error: err.response?.data?.error || 'Failed to create workspace' };
          }
        },

        setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),

        updateWorkspace: (updates) => {
          set((state) => ({
            workspaces: state.workspaces.map(w => w.id === updates.id ? { ...w, ...updates } : w),
            currentWorkspace: state.currentWorkspace?.id === updates.id ? { ...state.currentWorkspace, ...updates } : state.currentWorkspace,
          }));
        },

        addWorkspace: (workspace) => {
          set((state) => ({
            workspaces: state.workspaces.some(w => w.id === workspace.id)
              ? state.workspaces
              : [...state.workspaces, workspace],
          }));
        },

        updateMemberRole: (workspaceId, userId, role) => {
          set((state) => ({
            currentWorkspace: state.currentWorkspace?.id === workspaceId
              ? {
                  ...state.currentWorkspace,
                  members: state.currentWorkspace.members.map(m =>
                    m.user.id === userId ? { ...m, role } : m
                  ),
                }
              : state.currentWorkspace,
          }));
        },
      }),
      {
        name: 'workspace-storage',
        partialize: (state) => ({ currentWorkspace: state.currentWorkspace }),
      }
    )
  )
);
