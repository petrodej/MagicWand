import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import type { Computer } from '../stores/computerStore';
import { SystemInfoPanel } from '../components/SystemInfoPanel';
import { AIChat } from '../components/AIChat';
import { RemoteDesktop } from '../components/RemoteDesktop';
import { FileManager } from '../components/FileManager';

export function ComputerView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [computer, setComputer] = useState<Computer | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

  useEffect(() => {
    if (id) {
      api.get<Computer>(`/api/computers/${id}`).then(setComputer).catch(() => navigate('/dashboard'));
    }
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!computer || !confirm('Delete this computer?')) return;
    await api.del(`/api/computers/${computer.id}`);
    navigate('/dashboard');
  };

  if (!computer) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-300 transition-colors">
            Computers
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-100 font-medium">{computer.name}</span>
          <span className={`w-2 h-2 rounded-full ml-1 ${
            computer.isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-gray-600'
          }`} />
        </div>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-gray-600 hover:text-red-400">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Underline tabs */}
      <div className="flex gap-6 border-b border-gray-800/50 mb-6">
        {(['overview', 'remote', 'files', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-gray-100 border-teal-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab === 'overview' ? 'Overview' : tab === 'remote' ? 'Remote' : tab === 'files' ? 'Files' : 'AI Assistant'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        computer.isOnline ? (
          <SystemInfoPanel computerId={computer.id} />
        ) : (
          <div className="text-gray-600 py-12 text-center text-sm">
            Computer is offline. System info unavailable.
          </div>
        )
      ) : activeTab === 'files' ? (
        <FileManager computerId={computer.id} isOnline={computer.isOnline} />
      ) : activeTab === 'remote' ? (
        <div className="flex gap-4 h-[calc(100vh-180px)]">
          {/* Remote desktop — takes most of the space */}
          <div className="flex-1 min-w-0">
            <RemoteDesktop computerId={computer.id} isOnline={computer.isOnline} />
          </div>
          {/* AI Assistant sidebar */}
          <div className="w-[380px] shrink-0 border-l border-gray-800/50 pl-4">
            <AIChat computerId={computer.id} isOnline={computer.isOnline} />
          </div>
        </div>
      ) : (
        <AIChat computerId={computer.id} isOnline={computer.isOnline} />
      )}
    </div>
  );
}
