import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '../lib/api';
import type { Computer } from '../stores/computerStore';
import { SystemInfoPanel } from '../components/SystemInfoPanel';
import { StatusIndicator } from '../components/StatusIndicator';
import { AIChat } from '../components/AIChat';

export function ComputerView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [computer, setComputer] = useState<Computer | null>(null);
  const defaultTab = searchParams.get('tab') || 'overview';

  useEffect(() => {
    if (id) {
      api.get<Computer>(`/api/computers/${id}`).then(setComputer).catch(() => navigate('/dashboard'));
    }
  }, [id, navigate]);

  if (!computer) return <div className="bg-gray-950 min-h-screen text-white p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">{computer.name}</h1>
          <p className="text-xs text-gray-500 font-mono">{computer.hostname}</p>
        </div>
        <StatusIndicator online={computer.isOnline} />
      </header>

      <Tabs defaultValue={defaultTab} className="px-6 pt-4">
        <TabsList className="bg-gray-900 border border-gray-800">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="chat">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {computer.isOnline ? (
            <SystemInfoPanel computerId={computer.id} />
          ) : (
            <div className="text-gray-500 p-8 text-center">
              Computer is offline. System info unavailable.
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat">
          <AIChat computerId={computer.id} isOnline={computer.isOnline} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
