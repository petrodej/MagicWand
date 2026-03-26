import type { Computer } from '../stores/computerStore';

interface Props {
  computer: Computer;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

function ResourceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function ComputerCard({ computer, onClick, selectable, selected, onSelect }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border rounded-xl p-5 transition-colors hover:border-gray-700/50 ${
        selected ? 'border-teal-500/50 bg-teal-500/5' : 'border-gray-800/50'
      } ${!computer.isOnline ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => { e.stopPropagation(); onSelect?.(computer.id); }}
              onClick={(e) => e.stopPropagation()}
              className="accent-teal-500 shrink-0"
            />
          )}
          <span className="text-sm font-medium text-gray-100 truncate">{computer.hostname || computer.name}</span>
        </div>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          computer.isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-gray-600'
        }`} />
      </div>

      <p className="text-xs text-gray-500 font-mono truncate mb-4">
        {computer.os}{computer.ipAddress ? ` · ${computer.ipAddress}` : ''}
      </p>

      {computer.isOnline && (
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>CPU</span>
              <span>{computer.cpuPercent ?? 0}%</span>
            </div>
            <ResourceBar value={computer.cpuPercent ?? 0} color="bg-teal-500" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>RAM</span>
              <span>{computer.ramPercent ?? 0}%</span>
            </div>
            <ResourceBar value={computer.ramPercent ?? 0} color="bg-gray-400" />
          </div>
        </div>
      )}
    </button>
  );
}
