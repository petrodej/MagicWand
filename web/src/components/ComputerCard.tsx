import { useNavigate } from 'react-router-dom';
import { Monitor, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Computer } from '../stores/computerStore';
import { useComputerStore } from '../stores/computerStore';
import { StatusIndicator } from './StatusIndicator';
import { api } from '../lib/api';

function ResourceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function ComputerCard({ computer }: { computer: Computer }) {
  const navigate = useNavigate();
  const removeComputer = useComputerStore((s) => s.removeComputer);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remove "${computer.name}"?`)) return;
    await api.del(`/api/computers/${computer.id}`);
    removeComputer(computer.id);
  };

  const lastSeen = computer.lastSeen
    ? new Date(computer.lastSeen).toLocaleString()
    : 'Never';

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-lg p-5 transition-opacity ${
        !computer.isOnline ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-sm">{computer.name}</h3>
          <p className="text-xs text-gray-500 font-mono">{computer.hostname}</p>
        </div>
        <StatusIndicator online={computer.isOnline} />
      </div>

      {/* Info */}
      <div className="text-xs text-gray-400 space-y-1 mb-3">
        <div className="flex gap-1">
          <span className="text-gray-600">OS</span> {computer.os === 'pending' ? '—' : computer.os}
        </div>
        {computer.isOnline && computer.cpuPercent != null ? (
          <div className="flex gap-4">
            <span><span className="text-gray-600">CPU</span> {Math.round(computer.cpuPercent)}%</span>
            <span><span className="text-gray-600">RAM</span> {Math.round(computer.ramPercent || 0)}%</span>
          </div>
        ) : (
          <div className="text-gray-600">Last seen: {lastSeen}</div>
        )}
      </div>

      {/* Resource bars */}
      <div className="flex gap-2 mb-4">
        <ResourceBar value={computer.cpuPercent || 0} color="bg-blue-500" />
        <ResourceBar value={computer.ramPercent || 0} color="bg-purple-500" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 bg-purple-600/20 border-purple-600/40 text-purple-400 hover:bg-purple-600/30 text-xs"
          disabled={!computer.isOnline}
          onClick={() => navigate(`/computers/${computer.id}?tab=chat`)}
        >
          <MessageSquare className="w-3 h-3 mr-1" /> AI Chat
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-gray-700 text-gray-400 hover:bg-gray-800 text-xs"
          onClick={() => navigate(`/computers/${computer.id}`)}
        >
          <Monitor className="w-3 h-3 mr-1" /> Details
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-red-400 px-2"
          onClick={handleDelete}
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
