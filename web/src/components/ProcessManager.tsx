import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X, ArrowUpDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import { exportCsv } from '../lib/exportCsv';

interface Process {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
}

interface Props {
  computerId: string;
  isOnline: boolean;
}

export function ProcessManager({ computerId, isOnline }: Props) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'memory' | 'cpu' | 'name'>('memory');
  const [search, setSearch] = useState('');
  const [killing, setKilling] = useState<number | null>(null);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ processes: Process[]; total_count: number }>(
        `/api/computers/${computerId}/processes?sort=${sortBy}&limit=100`
      );
      setProcesses(data.processes);
      setTotalCount(data.total_count);
    } catch {}
    setLoading(false);
  }, [computerId, sortBy]);

  useEffect(() => {
    if (isOnline) fetchProcesses();
  }, [isOnline, fetchProcesses]);

  const killProcess = async (pid: number) => {
    if (!confirm(`Kill process PID ${pid}?`)) return;
    setKilling(pid);
    try {
      await api.post(`/api/computers/${computerId}/processes/kill`, { pid });
      setProcesses((prev) => prev.filter((p) => p.pid !== pid));
    } catch {}
    setKilling(null);
  };

  const toggleSort = (col: 'memory' | 'cpu' | 'name') => {
    setSortBy(col);
  };

  const filtered = search
    ? processes.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    : processes;

  if (!isOnline) {
    return <div className="text-gray-600 py-12 text-center text-sm">Computer is offline.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search processes..."
            className="bg-gray-800 border-gray-700 text-sm w-64"
          />
          <span className="text-xs text-gray-500">{totalCount} total processes</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => exportCsv(
              `processes-${new Date().toISOString().slice(0, 10)}.csv`,
              ['PID', 'Name', 'CPU %', 'RAM %'],
              filtered.map((p) => [String(p.pid), p.name, String(p.cpu_percent), String(p.memory_percent)])
            )}
            variant="ghost"
            className="text-gray-500 hover:text-gray-300"
            disabled={filtered.length === 0}
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={fetchProcesses} variant="ghost" className="text-gray-500 hover:text-gray-300" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800/50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium w-20">PID</th>
              <th className="text-left px-4 py-3 font-medium">
                <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-gray-300">
                  Name <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium w-28">
                <button onClick={() => toggleSort('cpu')} className="flex items-center gap-1 hover:text-gray-300">
                  CPU % <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-3 font-medium w-28">
                <button onClick={() => toggleSort('memory')} className="flex items-center gap-1 hover:text-gray-300">
                  RAM % <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.pid} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                <td className="px-4 py-2 text-gray-600 font-mono text-xs">{p.pid}</td>
                <td className="px-4 py-2 text-gray-200 text-xs">{p.name}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.cpu_percent > 50 ? 'bg-red-500' : p.cpu_percent > 10 ? 'bg-amber-500' : 'bg-teal-500'}`}
                        style={{ width: `${Math.min(p.cpu_percent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10">{p.cpu_percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${p.memory_percent > 50 ? 'bg-red-500' : p.memory_percent > 10 ? 'bg-amber-500' : 'bg-gray-400'}`}
                        style={{ width: `${Math.min(p.memory_percent, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-10">{p.memory_percent}%</span>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => killProcess(p.pid)}
                    disabled={killing === p.pid}
                    className="text-gray-700 hover:text-red-400 transition-colors"
                    title="Kill process"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
