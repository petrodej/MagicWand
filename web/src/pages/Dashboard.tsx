import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComputerStore } from '../stores/computerStore';
import { ComputerCard } from '../components/ComputerCard';
import { AddComputerModal } from '../components/AddComputerModal';
import { useAuthStore } from '../stores/authStore';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNavigate } from 'react-router-dom';
import { api, getWsBase } from '../lib/api';

export function Dashboard() {
  const { computers, loading, fetchComputers, updateStatus, updateHeartbeat } = useComputerStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [wsToken, setWsToken] = useState<string | null>(null);

  useEffect(() => {
    fetchComputers();
    api.get<{ token: string }>('/api/auth/ws-token').then((d) => setWsToken(d.token));
  }, [fetchComputers]);

  const wsUrl = wsToken
    ? `${getWsBase()}/ws/dashboard?token=${wsToken}`
    : '';

  useWebSocket({
    url: wsUrl,
    enabled: !!wsToken,
    onMessage: (data) => {
      if (data.type === 'status') {
        updateStatus(data.computerId, data.isOnline);
      } else if (data.type === 'heartbeat') {
        updateHeartbeat(data.computerId, {
          cpuPercent: data.cpuPercent,
          ramPercent: data.ramPercent,
          uptimeSeconds: data.uptimeSeconds,
        });
      }
    },
  });

  const onlineCount = computers.filter((c) => c.isOnline).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <span className="text-xl font-bold text-purple-400">✦ MagicWand</span>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-sm"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Computer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-400"
            onClick={async () => { await logout(); navigate('/login'); }}
          >
            Logout
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Your Computers</h2>
          <p className="text-sm text-gray-500">
            {computers.length} machine{computers.length !== 1 ? 's' : ''} — {onlineCount} online
          </p>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : computers.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">No computers registered</p>
            <p className="text-sm">Click "Add Computer" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {computers.map((c) => (
              <ComputerCard key={c.id} computer={c} />
            ))}
          </div>
        )}
      </main>

      <AddComputerModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
