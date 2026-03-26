import { useEffect, useState } from 'react';
import { Plus, Monitor, Play, X, Loader2, Filter, Wifi, Bell, ScrollText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useComputerStore } from '../stores/computerStore';
import { ComputerCard } from '../components/ComputerCard';
import { AddComputerModal } from '../components/AddComputerModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNavigate } from 'react-router-dom';
import { api, getWsBase } from '../lib/api';

interface CommandResult {
  computerId: string;
  computerName: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export function Dashboard() {
  const { computers, loading, fetchComputers, updateStatus, updateHeartbeat } = useComputerStore();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [wsToken, setWsToken] = useState<string | null>(null);

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [command, setCommand] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CommandResult[]>([]);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalComputers: number; onlineComputers: number;
    recentAlerts: number; recentAuditCount: number; scheduledTaskCount: number;
  } | null>(null);

  useEffect(() => {
    fetchComputers();
    api.get<{ token: string }>('/api/auth/ws-token').then((d) => setWsToken(d.token));
    api.get<typeof stats>('/api/dashboard/stats').then(setStats);
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnline = () => {
    setSelected(new Set(computers.filter((c) => c.isOnline).map((c) => c.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setResults([]);
    setCommand('');
  };

  const runCommand = async () => {
    if (!command.trim() || selected.size === 0) return;
    setRunning(true);
    setResults([]);

    const promises = Array.from(selected).map(async (computerId) => {
      const computer = computers.find((c) => c.id === computerId);
      try {
        const result = await api.post<{ stdout: string; stderr: string; exit_code: number }>(
          `/api/computers/${computerId}/execute`,
          { command, shell: 'powershell', timeout: 30 }
        );
        return {
          computerId,
          computerName: computer?.name || computerId,
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exit_code,
        };
      } catch (err: any) {
        return {
          computerId,
          computerName: computer?.name || computerId,
          stdout: '',
          stderr: '',
          exitCode: -1,
          error: err.message || 'Failed',
        };
      }
    });

    const allResults = await Promise.all(promises);
    setResults(allResults);
    setRunning(false);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Computers</h1>
          <p className="text-sm text-gray-500 mt-1">{computers.length} device(s) registered</p>
        </div>
        <div className="flex items-center gap-2">
          {!selectMode ? (
            <>
              <Button
                onClick={() => setSelectMode(true)}
                variant="ghost"
                className="text-gray-500 hover:text-gray-300"
                disabled={computers.filter((c) => c.isOnline).length === 0}
              >
                Multi-Action
              </Button>
              <Button
                onClick={() => setShowAddModal(true)}
                className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
              >
                <Plus className="w-4 h-4 mr-2" /> Add Computer
              </Button>
            </>
          ) : (
            <>
              <Button onClick={selectAllOnline} variant="ghost" className="text-gray-500 text-xs">
                Select All Online
              </Button>
              <Button onClick={exitSelectMode} variant="ghost" className="text-gray-500">
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats widgets */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <button onClick={() => {}} className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 text-left hover:border-gray-700/50 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="w-4 h-4 text-gray-600" />
              <span className="text-xs text-gray-500">Total</span>
            </div>
            <span className="text-2xl font-semibold text-gray-100">{stats.totalComputers}</span>
          </button>
          <button onClick={() => {}} className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 text-left hover:border-gray-700/50 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
            <span className="text-2xl font-semibold text-emerald-400">{stats.onlineComputers}</span>
          </button>
          <button onClick={() => navigate('/alerts')} className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 text-left hover:border-gray-700/50 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Bell className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-gray-500">Alerts (24h)</span>
            </div>
            <span className={`text-2xl font-semibold ${stats.recentAlerts > 0 ? 'text-amber-400' : 'text-gray-100'}`}>
              {stats.recentAlerts}
            </span>
          </button>
          <button onClick={() => navigate('/audit')} className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 text-left hover:border-gray-700/50 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <ScrollText className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">Events (24h)</span>
            </div>
            <span className="text-2xl font-semibold text-gray-100">{stats.recentAuditCount}</span>
          </button>
          <button onClick={() => navigate('/scheduled')} className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 text-left hover:border-gray-700/50 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-500" />
              <span className="text-xs text-gray-500">Scheduled</span>
            </div>
            <span className="text-2xl font-semibold text-gray-100">{stats.scheduledTaskCount}</span>
          </button>
        </div>
      )}

      {/* Batch command bar */}
      {selectMode && selected.size > 0 && (
        <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-400 mb-2">
            Run command on <span className="text-teal-400 font-medium">{selected.size}</span> selected computer(s):
          </p>
          <div className="flex gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runCommand()}
              placeholder="e.g., Get-Process | Sort-Object CPU -Desc | Select -First 5"
              className="bg-gray-800 border-gray-700 font-mono text-sm"
              disabled={running}
            />
            <Button
              onClick={runCommand}
              disabled={running || !command.trim()}
              className="bg-teal-500 hover:bg-teal-400 text-gray-950 shrink-0"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </Button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
              {results.map((r) => (
                <div key={r.computerId} className="bg-gray-950 border border-gray-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-300">{r.computerName}</span>
                    <span className={`text-xs ${r.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      exit {r.exitCode}
                    </span>
                  </div>
                  {r.error && <pre className="text-red-400 text-xs whitespace-pre-wrap">{r.error}</pre>}
                  {r.stdout && <pre className="text-gray-400 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">{r.stdout}</pre>}
                  {r.stderr && <pre className="text-red-400 text-xs whitespace-pre-wrap">{r.stderr}</pre>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tag filter */}
      {(() => {
        const allTags = [...new Set(computers.flatMap((c) => (c.tags || '').split(',').map(t => t.trim()).filter(Boolean)))].sort();
        if (allTags.length === 0) return null;
        return (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-gray-600" />
            <button
              onClick={() => setFilterTag(null)}
              className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                !filterTag ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'text-gray-500 border-gray-800 hover:border-gray-700'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  filterTag === tag ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'text-gray-500 border-gray-800 hover:border-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        );
      })()}

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
          {computers.filter((c) => !filterTag || (c.tags || '').split(',').map(t => t.trim()).includes(filterTag)).map((c) => (
            <ComputerCard
              key={c.id}
              computer={c}
              onClick={() => selectMode ? toggleSelect(c.id) : navigate(`/computers/${c.id}`)}
              selectable={selectMode}
              selected={selected.has(c.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      <AddComputerModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
