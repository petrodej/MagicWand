import { create } from 'zustand';
import { api } from '../lib/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  role: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  role: 'viewer',

  login: async (email, password) => {
    await api.post('/api/auth/login', { email, password });
    const me = await api.get<{ role: string }>('/api/auth/me');
    set({ isAuthenticated: true, role: me.role });
  },

  logout: async () => {
    await api.post('/api/auth/logout');
    set({ isAuthenticated: false, role: 'viewer' });
  },

  checkAuth: async () => {
    try {
      const me = await api.get<{ role: string }>('/api/auth/me');
      set({ isAuthenticated: true, isLoading: false, role: me.role });
    } catch (e) {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
