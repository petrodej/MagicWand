import { create } from 'zustand';
import { api } from '../lib/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    await api.post('/api/auth/login', { email, password });
    set({ isAuthenticated: true });
  },

  logout: async () => {
    await api.post('/api/auth/logout');
    set({ isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      await api.get('/api/auth/me');
      set({ isAuthenticated: true, isLoading: false });
    } catch (e) {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
