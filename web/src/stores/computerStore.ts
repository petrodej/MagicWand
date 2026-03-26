import { create } from 'zustand';
import { api } from '../lib/api';

export interface Computer {
  id: string;
  name: string;
  hostname: string;
  os: string;
  cpuModel: string | null;
  ramTotalMb: number | null;
  isOnline: boolean;
  lastSeen: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  agentVersion: string | null;
  tags?: string;
  // Live heartbeat data (from WebSocket, not DB)
  cpuPercent?: number;
  ramPercent?: number;
  uptimeSeconds?: number;
}

interface ComputerState {
  computers: Computer[];
  loading: boolean;
  fetchComputers: () => Promise<void>;
  updateStatus: (computerId: string, isOnline: boolean) => void;
  updateHeartbeat: (computerId: string, data: { cpuPercent: number; ramPercent: number; uptimeSeconds: number }) => void;
  removeComputer: (id: string) => void;
}

export const useComputerStore = create<ComputerState>((set) => ({
  computers: [],
  loading: true,

  fetchComputers: async () => {
    try {
      const data = await api.get<Computer[]>('/api/computers');
      set({ computers: data, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  updateStatus: (computerId, isOnline) => {
    set((state) => ({
      computers: state.computers.map((c) =>
        c.id === computerId ? { ...c, isOnline } : c
      ),
    }));
  },

  updateHeartbeat: (computerId, data) => {
    set((state) => ({
      computers: state.computers.map((c) =>
        c.id === computerId ? { ...c, ...data, isOnline: true } : c
      ),
    }));
  },

  removeComputer: (id) => {
    set((state) => ({
      computers: state.computers.filter((c) => c.id !== id),
    }));
  },
}));
