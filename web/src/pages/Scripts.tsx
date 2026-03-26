import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import type { Computer } from '../stores/computerStore';

interface Script {
  id: string;
  name: string;
  description: string;
  command: string;
  shell: string;
  updatedAt: string;
}

interface RunResult {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  error?: string;
}

export function Scripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', command: '', shell: 'powershell' });
  const [runTarget, setRunTarget] = useState<{ scriptId: string; computerId: string } | null>(null);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const fetchScripts = async () => {
    const data = await api.get<Script[]>('/api/scripts');
    setScripts(data);
  };

  useEffect(() => {
    fetchScripts();
    api.get<Computer[]>('/api/computers').then(setComputers);
  }, []);

  const saveScript = async () => {
    if (!form.name || !form.command) return;
    if (editId) {
      await api.put(`/api/scripts/${editId}`, form);
    } else {
      await api.post('/api/scripts', form);
    }
    setForm({ name: '', description: '', command: '', shell: 'powershell' });
    setShowForm(false);
    setEditId(null);
    fetchScripts();
  };

  const deleteScript = async (id: string) => {
    if (!confirm('Delete this script?')) return;
    await api.del(`/api/scripts/${id}`);
    fetchScripts();
  };

  const editScript = (s: Script) => {
    setForm({ name: s.name, description: s.description, command: s.command, shell: s.shell });
    setEditId(s.id);
    setShowForm(true);
  };

  const runScript = async (scriptId: string, computerId: string) => {
    setRunning(true);
    setRunResult(null);
    setRunTarget({ scriptId, computerId });
    try {
      const result = await api.post<RunResult>(`/api/scripts/${scriptId}/run`, { computerId });
      setRunResult(result);
    } catch (err: any) {
      setRunResult({ error: err.message || 'Failed' });
    }
    setRunning(false);
  };

  const onlineComputers = computers.filter((c) => c.isOnline);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Script Library</h1>
          <p className="text-sm text-gray-500 mt-1">{scripts.length} saved script(s)</p>
        </div>
        <Button
          onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', description: '', command: '', shell: 'powershell' }); }}
          className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> New Script
        </Button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-5 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-gray-800 border-gray-700" placeholder="e.g., Clear temp files" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Description</label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-gray-800 border-gray-700" placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Command</label>
            <textarea
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              rows={5}
              className="w-full px-3 py-2 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200 font-mono resize-y"
              placeholder="Get-ChildItem $env:TEMP | Remove-Item -Recurse -Force"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null); }} className="text-gray-500">Cancel</Button>
            <Button onClick={saveScript} disabled={!form.name || !form.command} className="bg-teal-500 hover:bg-teal-400 text-gray-950">
              {editId ? 'Update' : 'Save'} Script
            </Button>
          </div>
        </div>
      )}

      {scripts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Code2 className="w-12 h-12 text-gray-700 mb-4" />
          <p className="text-gray-500">No scripts saved yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scripts.map((s) => (
            <div key={s.id} className="bg-gray-900 border border-gray-800/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium text-gray-100">{s.name}</span>
                  {s.description && <span className="text-xs text-gray-500 ml-2">{s.description}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => editScript(s)} className="text-gray-600 hover:text-teal-400 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteScript(s.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <pre className="text-xs text-gray-500 font-mono bg-gray-950 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto whitespace-pre-wrap">{s.command}</pre>

              {/* Run on computer */}
              <div className="flex items-center gap-2">
                <select
                  className="h-8 px-2 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-300"
                  defaultValue=""
                  onChange={(e) => e.target.value && runScript(s.id, e.target.value)}
                  disabled={running && runTarget?.scriptId === s.id}
                >
                  <option value="" disabled>Run on...</option>
                  {onlineComputers.map((c) => (
                    <option key={c.id} value={c.id}>{c.hostname || c.name}</option>
                  ))}
                </select>
                {running && runTarget?.scriptId === s.id && (
                  <span className="text-xs text-gray-500">Running...</span>
                )}
              </div>

              {/* Result */}
              {runResult && runTarget?.scriptId === s.id && (
                <div className="mt-3 bg-gray-950 border border-gray-800/50 rounded-lg p-3">
                  {runResult.error && <pre className="text-red-400 text-xs whitespace-pre-wrap">{runResult.error}</pre>}
                  {runResult.stdout && <pre className="text-gray-400 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">{runResult.stdout}</pre>}
                  {runResult.stderr && <pre className="text-red-400 text-xs whitespace-pre-wrap">{runResult.stderr}</pre>}
                  {runResult.exit_code != null && (
                    <span className={`text-xs mt-1 inline-block ${runResult.exit_code === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      exit {runResult.exit_code}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
