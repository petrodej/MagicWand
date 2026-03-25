import { useEffect, useState } from 'react';
import { Plus, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComputerStore } from '../stores/computerStore';
import { ComputerCard } from '../components/ComputerCard';
import { AddComputerModal } from '../components/AddComputerModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNavigate } from 'react-router-dom';
import { api, getWsBase } from '../lib/api';

export function Dashboard() {
  const { computers, loading, fetchComputers, updateStatus, updateHeartbeat } = useComputerStore();
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Computers</h1>
          <p className="text-sm text-gray-500 mt-1">{computers.length} device(s) registered</p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Computer
        </Button>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading...</div>
      ) : computers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Monitor className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-500 mb-4">No computers registered yet</p>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Computer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {computers.map((c) => (
            <ComputerCard key={c.id} computer={c} onClick={() => navigate(`/computers/${c.id}`)} />
          ))}
        </div>
      )}

      <AddComputerModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
