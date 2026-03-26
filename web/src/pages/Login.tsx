import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
                <span className="text-teal-400 font-bold text-lg">P</span>
              </div>
              <h1 className="text-xl font-semibold text-gray-100">Pulse</h1>
            </div>
            <p className="text-gray-500 text-sm">Remote Management Platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-gray-800/50 border-gray-800 text-gray-100 placeholder:text-gray-600"
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-gray-800/50 border-gray-800 text-gray-100 placeholder:text-gray-600"
                required
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
