import { useState } from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { api } from '../lib/api';
import { useComputerStore } from '../stores/computerStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface EnrollmentData {
  id: string;
  enrollToken: string;
  enrollCommand: string;
}

export function AddComputerModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [enrollment, setEnrollment] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fetchComputers = useComputerStore((s) => s.fetchComputers);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await api.post<EnrollmentData>('/api/computers', { name: name || 'New Computer' });
      setEnrollment(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setName('');
    setEnrollment(null);
    setCopied(false);
    fetchComputers();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Computer</DialogTitle>
        </DialogHeader>

        {!enrollment ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Computer Name (optional)</label>
              <Input
                placeholder="e.g., Gaming PC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Generate Install Command
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">
              Run this command on the remote computer to install the agent:
            </p>

            <div className="relative">
              <pre className="bg-gray-800 border border-gray-700 rounded-lg p-3 pr-12 text-xs font-mono text-green-400 overflow-x-auto whitespace-pre-wrap break-all">
                python main.py --enroll {enrollment.enrollToken} --server {window.location.origin}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 text-gray-400 hover:text-white"
                onClick={() => handleCopy(
                  `python main.py --enroll ${enrollment.enrollToken} --server ${window.location.origin}`
                )}
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Waiting for agent to connect...
            </div>

            <p className="text-xs text-gray-600">
              Token expires in 15 minutes.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
