import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { authApi, usersApi } from '@/lib/api';

export const useAuthStore = create(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,

        setUser: (user) => set({ user, isAuthenticated: !!user }),
        setAccessToken: (token) => {
          if (typeof window !== 'undefined') window.__accessToken = token;
          set({ accessToken: token });
        },

        login: async (credentials) => {
          set({ isLoading: true, error: null });
          try {
            const { data } = await authApi.login(credentials);
            if (typeof window !== 'undefined') window.__accessToken = data.accessToken;
            set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false });
            return { success: true };
          } catch (err) {
            const error = err.response?.data?.error || 'Login failed';
            set({ error, isLoading: false });
            return { success: false, error };
          }
        },

        register: async (data) => {
          set({ isLoading: true, error: null });
          try {
            const { data: res } = await authApi.register(data);
            if (typeof window !== 'undefined') window.__accessToken = res.accessToken;
            set({ user: res.user, accessToken: res.accessToken, isAuthenticated: true, isLoading: false });
            return { success: true };
          } catch (err) {
            const error = err.response?.data?.error || 'Registration failed';
            set({ error, isLoading: false });
            return { success: false, error };
          }
        },

        logout: async () => {
          try { await authApi.logout(); } catch (_) {}
          if (typeof window !== 'undefined') window.__accessToken = null;
          set({ user: null, accessToken: null, isAuthenticated: false });
        },

        refreshAuth: async () => {
          try {
            const { data } = await authApi.refresh();
            if (typeof window !== 'undefined') window.__accessToken = data.accessToken;
            set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true });
            return true;
          } catch (_) {
            set({ user: null, accessToken: null, isAuthenticated: false });
            return false;
          }
        },

        updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),

        clearError: () => set({ error: null }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      }
    )
  )
);
