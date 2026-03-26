import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Play, Square, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';

interface Service {
  Name: string;
  DisplayName: string;
  Status: string;
  StartType: string;
}

interface Props {
  computerId: string;
  isOnline: boolean;
}

export function ServiceManager({ computerId, isOnline }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [managing, setManaging] = useState<string | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      const data = await api.get<{ services: Service[]; total_count: number }>(
        `/api/computers/${computerId}/services?${params}`
      );
      setServices(data.services);
    } catch {}
    setLoading(false);
  }, [computerId, filterStatus]);

  useEffect(() => {
    if (isOnline) fetchServices();
  }, [isOnline, fetchServices]);

  const manageService = async (serviceName: string, action: string) => {
    setManaging(serviceName);
    try {
      await api.post(`/api/computers/${computerId}/services/manage`, { serviceName, action });
      await fetchServices();
    } catch {}
    setManaging(null);
  };

  const filtered = search
    ? services.filter((s) =>
        s.Name.toLowerCase().includes(search.toLowerCase()) ||
        s.DisplayName.toLowerCase().includes(search.toLowerCase())
      )
    : services;

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
            placeholder="Search services..."
            className="bg-gray-800 border-gray-700 text-sm w-64"
          />
          <div className="flex gap-1">
            {['', 'Running', 'Stopped'].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  filterStatus === s ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'text-gray-500 border-gray-800 hover:border-gray-700'
                }`}
              >
                {s || 'All'}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={fetchServices} variant="ghost" className="text-gray-500 hover:text-gray-300" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="bg-gray-900 border border-gray-800/50 rounded-xl overflow-hidden max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="border-b border-gray-800/50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Display Name</th>
              <th className="text-left px-4 py-3 font-medium w-24">Status</th>
              <th className="text-left px-4 py-3 font-medium w-24">Start Type</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.Name} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                <td className="px-4 py-2 text-gray-200 text-xs font-mono">{s.Name}</td>
                <td className="px-4 py-2 text-gray-400 text-xs truncate max-w-[300px]">{s.DisplayName}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium ${
                    s.Status === 'Running' ? 'text-emerald-400' : s.Status === 'Stopped' ? 'text-gray-500' : 'text-amber-400'
                  }`}>
                    {s.Status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-gray-600">{s.StartType}</td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1">
                    {s.Status !== 'Running' && (
                      <button
                        onClick={() => manageService(s.Name, 'start')}
                        disabled={managing === s.Name}
                        className="text-gray-600 hover:text-emerald-400 transition-colors p-1"
                        title="Start"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {s.Status === 'Running' && (
                      <>
                        <button
                          onClick={() => manageService(s.Name, 'stop')}
                          disabled={managing === s.Name}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1"
                          title="Stop"
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => manageService(s.Name, 'restart')}
                          disabled={managing === s.Name}
                          className="text-gray-600 hover:text-amber-400 transition-colors p-1"
                          title="Restart"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
