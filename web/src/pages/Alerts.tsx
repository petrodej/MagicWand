import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';

interface AlertRule {
  id: string;
  computerId: string | null;
  computer: { id: string; name: string } | null;
  type: string;
  threshold: number | null;
  webhookUrl: string | null;
  enabled: boolean;
  createdAt: string;
}

interface AlertLog {
  id: string;
  computerId: string;
  computer: { id: string; name: string };
  type: string;
  message: string;
  resolved: boolean;
  createdAt: string;
}

interface Computer {
  id: string;
  name: string;
}

export function Alerts() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // New rule form
  const [newType, setNewType] = useState('offline');
  const [newComputerId, setNewComputerId] = useState('');
  const [newThreshold, setNewThreshold] = useState('80');
  const [newWebhook, setNewWebhook] = useState('');

  const fetchData = async () => {
    const [r, l, c] = await Promise.all([
      api.get<AlertRule[]>('/api/alerts/rules'),
      api.get<AlertLog[]>('/api/alerts/logs'),
      api.get<Computer[]>('/api/computers'),
    ]);
    setRules(r);
    setLogs(l);
    setComputers(c);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const createRule = async () => {
    await api.post('/api/alerts/rules', {
      type: newType,
      computerId: newComputerId || null,
      threshold: ['cpu', 'ram', 'disk'].includes(newType) ? Number(newThreshold) : null,
      webhookUrl: newWebhook || null,
    });
    setShowAdd(false);
    setNewType('offline');
    setNewComputerId('');
    setNewThreshold('80');
    setNewWebhook('');
    fetchData();
  };

  const deleteRule = async (id: string) => {
    await api.del(`/api/alerts/rules/${id}`);
    fetchData();
  };

  const toggleRule = async (id: string) => {
    await api.put(`/api/alerts/rules/${id}/toggle`);
    fetchData();
  };

  const clearLogs = async () => {
    await api.del('/api/alerts/logs');
    fetchData();
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case 'offline': return 'Goes Offline';
      case 'cpu': return 'CPU Usage';
      case 'ram': return 'RAM Usage';
      case 'disk': return 'Disk Usage';
      default: return type;
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'offline': return 'text-red-400';
      case 'cpu': return 'text-orange-400';
      case 'ram': return 'text-yellow-400';
      case 'disk': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">{rules.length} rule(s) configured</p>
        </div>
        <Button
          onClick={() => setShowAdd(!showAdd)}
          className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Rule
        </Button>
      </div>

      {/* Add rule form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Alert Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
              >
                <option value="offline">Goes Offline</option>
                <option value="cpu">CPU Usage</option>
                <option value="ram">RAM Usage</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Computer (optional — blank = all)</label>
              <select
                value={newComputerId}
                onChange={(e) => setNewComputerId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100"
              >
                <option value="">All Computers</option>
                {computers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {['cpu', 'ram', 'disk'].includes(newType) && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Threshold (%)</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="bg-gray-800 border-gray-700 w-32"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Webhook URL (optional)</label>
            <Input
              placeholder="https://hooks.slack.com/..."
              value={newWebhook}
              onChange={(e) => setNewWebhook(e.target.value)}
              className="bg-gray-800 border-gray-700"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={createRule} className="bg-teal-500 hover:bg-teal-400 text-gray-950">
              Create Rule
            </Button>
            <Button variant="ghost" onClick={() => setShowAdd(false)} className="text-gray-500">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-2 mb-8">
        {rules.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-8">
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-700" />
            No alert rules configured
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className={`flex items-center justify-between bg-gray-900 border border-gray-800/50 rounded-lg px-4 py-3 ${!rule.enabled ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-4 h-4 ${typeColor(rule.type)}`} />
                <div>
                  <span className="text-sm text-gray-100">{typeLabel(rule.type)}</span>
                  {rule.threshold && <span className="text-gray-500 text-sm ml-1">&gt; {rule.threshold}%</span>}
                  <span className="text-gray-600 text-xs ml-2">
                    {rule.computer ? rule.computer.name : 'All computers'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rule.webhookUrl && <span className="text-xs text-gray-600">webhook</span>}
                <button onClick={() => toggleRule(rule.id)} className="text-gray-500 hover:text-teal-400">
                  {rule.enabled ? <ToggleRight className="w-5 h-5 text-teal-400" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => deleteRule(rule.id)} className="text-gray-500 hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alert log */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Recent Alerts</h2>
        {logs.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearLogs} className="text-gray-600 text-xs">
            Clear All
          </Button>
        )}
      </div>

      <div className="space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-6">No alerts fired yet</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between bg-gray-900/50 border border-gray-800/30 rounded-lg px-4 py-2">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-3.5 h-3.5 ${typeColor(log.type)}`} />
                <span className="text-sm text-gray-300">{log.message}</span>
                <span className="text-xs text-gray-600">{log.computer?.name}</span>
              </div>
              <span className="text-xs text-gray-600">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
