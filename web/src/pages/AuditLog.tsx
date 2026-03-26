import { useEffect, useState } from 'react';
import { ScrollText, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';

interface AuditEntry {
  id: string;
  action: string;
  computerId: string | null;
  computer: { name: string; hostname: string } | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  execute_command: { label: 'Command', color: 'text-blue-400' },
  computer_add: { label: 'Add Computer', color: 'text-emerald-400' },
  computer_delete: { label: 'Delete Computer', color: 'text-red-400' },
  file_upload: { label: 'File Upload', color: 'text-amber-400' },
  file_delete: { label: 'File Delete', color: 'text-red-400' },
  remote_session: { label: 'Remote Session', color: 'text-purple-400' },
  alert_rule_create: { label: 'Alert Rule', color: 'text-teal-400' },
};

export function AuditLog() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');

  const fetchLogs = async (p = page, action = filter) => {
    const params = new URLSearchParams({ page: String(p), limit: '50' });
    if (action) params.set('action', action);
    const data = await api.get<{ logs: AuditEntry[]; total: number; pages: number }>(
      `/api/audit/logs?${params}`
    );
    setLogs(data.logs);
    setTotal(data.total);
    setPages(data.pages);
  };

  useEffect(() => {
    fetchLogs(page, filter);
  }, [page, filter]);

  const clearAll = async () => {
    if (!confirm('Clear all audit logs?')) return;
    await api.del('/api/audit/logs');
    setLogs([]);
    setTotal(0);
  };

  const formatDetails = (details: string | null) => {
    if (!details) return null;
    try {
      const obj = JSON.parse(details);
      if (obj.command) return obj.command;
      if (obj.path) return obj.path;
      if (obj.name) return obj.name;
      return JSON.stringify(obj);
    } catch {
      return details;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">{total} event(s) recorded</p>
        </div>
        <Button
          onClick={clearAll}
          variant="ghost"
          className="text-gray-600 hover:text-red-400"
          disabled={logs.length === 0}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Clear All
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => { setFilter(''); setPage(1); }}
          className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
            !filter ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'text-gray-500 border-gray-800 hover:border-gray-700'
          }`}
        >
          All
        </button>
        {['execute_command', 'computer_add', 'computer_delete', 'file_upload', 'file_delete'].map((a) => (
          <button
            key={a}
            onClick={() => { setFilter(filter === a ? '' : a); setPage(1); }}
            className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
              filter === a ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'text-gray-500 border-gray-800 hover:border-gray-700'
            }`}
          >
            {ACTION_LABELS[a]?.label || a}
          </button>
        ))}
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ScrollText className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-500">No audit events yet</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/50 text-gray-500 text-xs">
                  <th className="text-left px-4 py-3 font-medium">Time</th>
                  <th className="text-left px-4 py-3 font-medium">Action</th>
                  <th className="text-left px-4 py-3 font-medium">Computer</th>
                  <th className="text-left px-4 py-3 font-medium">Details</th>
                  <th className="text-left px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const meta = ACTION_LABELS[log.action] || { label: log.action, color: 'text-gray-400' };
                  return (
                    <tr key={log.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {log.computer?.hostname || log.computer?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-[300px]">
                        {formatDetails(log.details) || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                        {log.ipAddress || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-500">
                Page {page} of {pages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="text-gray-500"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
