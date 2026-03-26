import { create } from 'zustand';
import { X, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  createdAt: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts.slice(-4), { ...toast, id, createdAt: Date.now() }],
    }));
    // Auto-remove after 5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

const ICON_MAP = {
  info: <Wifi className="w-4 h-4 text-teal-400" />,
  success: <Wifi className="w-4 h-4 text-emerald-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
  error: <WifiOff className="w-4 h-4 text-red-400" />,
};

const BG_MAP = {
  info: 'border-teal-500/20',
  success: 'border-emerald-500/20',
  warning: 'border-amber-500/20',
  error: 'border-red-500/20',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`bg-gray-900 border ${BG_MAP[toast.type]} rounded-lg px-4 py-3 shadow-xl flex items-start gap-3 animate-in slide-in-from-right-5 fade-in duration-200`}
        >
          <div className="mt-0.5">{ICON_MAP[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200">{toast.title}</p>
            {toast.message && <p className="text-xs text-gray-500 mt-0.5">{toast.message}</p>}
          </div>
          <button onClick={() => removeToast(toast.id)} className="text-gray-600 hover:text-gray-400 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
