import { useEffect, useState } from 'react';
import { HardDrive, Cpu, MemoryStick, Wifi } from 'lucide-react';
import { api } from '../lib/api';

interface SystemInfo {
  hostname: string;
  os: string;
  os_version: string;
  cpu_model: string;
  cpu_count: number;
  cpu_percent: number;
  ram_total_mb: number;
  ram_used_mb: number;
  ram_percent: number;
  disks: { device: string; mountpoint: string; total_gb: number; used_gb: number; percent: number }[];
  network_interfaces: { interface: string; ip: string }[];
  uptime_seconds: number;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${days}d ${hours}h ${mins}m`;
}

export function SystemInfoPanel({ computerId }: { computerId: string }) {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get<SystemInfo>(`/api/computers/${computerId}/system-info`)
      .then(setInfo)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [computerId]);

  if (loading) return <div className="text-gray-500 p-4">Fetching system info...</div>;
  if (error) return <div className="text-red-400 p-4">{error}</div>;
  if (!info) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4" /> System
        </h3>
        <div className="space-y-2 text-sm">
          <div><span className="text-gray-500">Hostname:</span> {info.hostname}</div>
          <div><span className="text-gray-500">OS:</span> {info.os}</div>
          <div><span className="text-gray-500">CPU:</span> {info.cpu_model} ({info.cpu_count} cores)</div>
          <div><span className="text-gray-500">Uptime:</span> {formatUptime(info.uptime_seconds)}</div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <MemoryStick className="w-4 h-4" /> Resources
        </h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>CPU</span><span>{info.cpu_percent}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${info.cpu_percent}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>RAM ({info.ram_used_mb}MB / {info.ram_total_mb}MB)</span><span>{info.ram_percent}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-500 rounded-full" style={{ width: `${info.ram_percent}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <HardDrive className="w-4 h-4" /> Disks
        </h3>
        <div className="space-y-2 text-sm">
          {info.disks.map((d) => (
            <div key={d.mountpoint}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{d.mountpoint} ({d.device})</span>
                <span>{d.used_gb}GB / {d.total_gb}GB</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${d.percent > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${d.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
          <Wifi className="w-4 h-4" /> Network
        </h3>
        <div className="space-y-1 text-sm">
          {info.network_interfaces.map((n, i) => (
            <div key={i}>
              <span className="text-gray-500">{n.interface}:</span>{' '}
              <span className="font-mono text-xs">{n.ip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
