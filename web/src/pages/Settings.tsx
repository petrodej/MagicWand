import { useEffect, useState } from 'react';
import { Plus, Trash2, Shield, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export function Settings() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', password: '', role: 'viewer' });
  const [error, setError] = useState('');
  const role = useAuthStore((s) => s.role);

  const fetchUsers = async () => {
    try {
      const data = await api.get<User[]>('/api/users');
      setUsers(data);
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const createUser = async () => {
    setError('');
    if (!form.email || !form.name || !form.password) {
      setError('All fields are required.');
      return;
    }
    try {
      await api.post('/api/users', form);
      setForm({ email: '', name: '', password: '', role: 'viewer' });
      setShowForm(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user.');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api.del(`/api/users/${id}`);
      fetchUsers();
    } catch {}
  };

  const toggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'viewer' : 'admin';
    try {
      await api.put(`/api/users/${id}/role`, { role: newRole });
      fetchUsers();
    } catch {}
  };

  const resetPassword = async (id: string) => {
    const password = prompt('New password (min 6 chars):');
    if (!password || password.length < 6) return;
    try {
      await api.put(`/api/users/${id}/password`, { password });
      alert('Password updated.');
    } catch {}
  };

  if (role !== 'admin') {
    return (
      <div className="p-8">
        <div className="text-gray-600 py-12 text-center text-sm">
          Admin access required to manage users.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">{users.length} user(s)</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-2" /> Add User
        </Button>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-5 mb-6 space-y-4">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Password</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full h-9 px-3 rounded-md bg-gray-800 border border-gray-700 text-sm text-gray-200"
              >
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowForm(false)} className="text-gray-500">Cancel</Button>
            <Button onClick={createUser} className="bg-teal-500 hover:bg-teal-400 text-gray-950">Create User</Button>
          </div>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800/50 text-gray-500 text-xs">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium w-24">Role</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-800/30 hover:bg-gray-800/20">
                <td className="px-4 py-3 text-gray-200">{u.name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{u.email}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleRole(u.id, u.role)}
                    className={`flex items-center gap-1 text-xs font-medium ${
                      u.role === 'admin' ? 'text-amber-400' : 'text-gray-500'
                    } hover:opacity-80`}
                    title="Click to toggle role"
                  >
                    {u.role === 'admin' ? <Shield className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {u.role}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resetPassword(u.id)}
                      className="text-xs text-gray-600 hover:text-teal-400 transition-colors"
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-gray-700 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
