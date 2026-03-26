import { useEffect, useState } from 'react';
import { Clock, Plus, Trash2, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import type { Computer } from '../stores/computerStore';

interface ScheduledTask {
  id: string;
  name: string;
  computerId: string;
  computer: { name: string; hostname: string } | null;
  command: string;
  shell: string;
  cronExpr: string;
  enabled: boolean;
  lastRun: string | null;
  lastResult: string | null;
  nextRun: string | null;
}

const CRON_PRESETS = [
  { label: 'Every 5 min', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Weekly (Mon 9 AM)', value: '0 9 * * 1' },
];

export function ScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', computerId: '', command: '', cronExpr: '0 * * * *' });

  const fetchTasks = async () => {
    const data = await api.get<ScheduledTask[]>('/api/scheduled-tasks');
    setTasks(data);
  };

  useEffect(() => {
    fetchTasks();
    api.get<Computer[]>('/api/computers').then(setComputers);
  }, []);

  const createTask = async () => {
    if (!form.name || !form.computerId || !form.command || !form.cronExpr) return;
    await api.post('/api/scheduled-tasks', form);
    setForm({ name: '', computerId: '', command: '', cronExpr: '0 * * * *' });
    setShowForm(false);
    fetchTasks();
  };

  const toggleTask = async (id: string) => {
    await api.put(`/api/scheduled-tasks/${id}/toggle`, {});
    fetchTasks();
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this scheduled task?')) return;
    await api.del(`/api/scheduled-tasks/${id}`);
    fetchTasks();
  };

  const getLastResult = (result: string | null) => {
    if (!result) return null;
    try {
      const obj = JSON.parse(result);
      if (obj.error) return { status: 'error', text: obj.error };
      return { status: obj.exit_code === 0 ? 'success' : 'failed', text: obj.stdout || obj.stderr || '' };
    } catch {
      return null;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Scheduled Tasks</h1>
          <p className="text-sm text-gray-500 mt-1">{tasks.length} task(s) configured</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> New Task
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Task Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Clear temp files"
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Computer</label>
              <select
                value={form.computerId}
                onChange={(e) => setForm({ ...form, computerId: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200"
              >
                <option value="">Select computer...</option>
                {computers.map((c) => (
                  <option key={c.id} value={c.id}>{c.hostname || c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Command</label>
            <Input
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              placeholder="e.g., Remove-Item $env:TEMP\* -Recurse -Force"
              className="bg-gray-800 border-gray-700 font-mono text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Schedule (cron)</label>
            <div className="flex gap-2 items-center">
              <Input
                value={form.cronExpr}
                onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
                placeholder="* * * * *"
                className="bg-gray-800 border-gray-700 font-mono text-sm w-48"
              />
              <div className="flex gap-1 flex-wrap">
                {CRON_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setForm({ ...form, cronExpr: p.value })}
                    className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                      form.cronExpr === p.value
                        ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                        : 'text-gray-500 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-gray-500">
              Cancel
            </Button>
            <Button
              onClick={createTask}
              disabled={!form.name || !form.computerId || !form.command}
              className="bg-teal-500 hover:bg-teal-400 text-gray-950"
            >
              Create Task
            </Button>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-500">No scheduled tasks yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const result = getLastResult(task.lastResult);
            return (
              <div
                key={task.id}
                className={`bg-gray-900 border border-gray-800/50 rounded-xl p-4 ${
                  !task.enabled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleTask(task.id)} className="text-gray-500 hover:text-teal-400">
                      {task.enabled ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <div>
                      <span className="text-sm font-medium text-gray-100">{task.name}</span>
                      <span className="text-xs text-gray-600 ml-2">
                        on {task.computer?.hostname || task.computer?.name || '?'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 font-mono">{task.cronExpr}</span>
                    <button onClick={() => deleteTask(task.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 ml-7">
                  <code className="text-xs text-gray-500 font-mono">{task.command}</code>
                </div>

                {(task.lastRun || result) && (
                  <div className="mt-2 ml-7 flex items-center gap-3 text-xs">
                    {task.lastRun && (
                      <span className="text-gray-600">
                        Last run: {new Date(task.lastRun).toLocaleString()}
                      </span>
                    )}
                    {result && (
                      <span className={
                        result.status === 'success' ? 'text-emerald-400' :
                        result.status === 'error' ? 'text-red-400' : 'text-amber-400'
                      }>
                        {result.status === 'success' ? 'OK' : result.status === 'error' ? 'Error' : 'Failed'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
