import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useSocketStore = create(
  devtools((set, get) => ({
    socket: null,
    onlineMembers: [],
    isConnected: false,

    setSocket: (socket) => set({ socket }),
    setConnected: (isConnected) => set({ isConnected }),
    setOnlineMembers: (members) => set({ onlineMembers: members }),

    addOnlineMember: (userId) => {
      set((state) => ({
        onlineMembers: state.onlineMembers.includes(userId)
          ? state.onlineMembers
          : [...state.onlineMembers, userId],
      }));
    },

    removeOnlineMember: (userId) => {
      set((state) => ({
        onlineMembers: state.onlineMembers.filter(id => id !== userId),
      }));
    },

    emit: (event, data) => {
      const { socket } = get();
      if (socket) socket.emit(event, data);
    },
  }))
);

export const useNotificationStore = create(
  devtools((set, get) => ({
    notifications: [],
    unreadCount: 0,

    setNotifications: (notifications, unreadCount) => set({ notifications, unreadCount }),

    addNotification: (notification) => {
      set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      }));
    },

    markRead: (id) => {
      set((state) => ({
        notifications: state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    },

    markAllRead: () => {
      set((state) => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    },
  }))
);
