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
      <DialogContent className="bg-gray-900 border border-gray-800/50 text-gray-100 rounded-xl max-w-md">
        <DialogHeader>
          <DialogTitle>Add Computer</DialogTitle>
        </DialogHeader>

        {!enrollment ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 block mb-1">Computer Name (optional)</label>
              <Input
                placeholder="e.g., Gaming PC"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-gray-800/50 border-gray-800 text-gray-100 placeholder:text-gray-600"
              />
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Generate Install Command
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Download and run this installer on the remote Windows computer:
            </p>

            <a
              href={`${window.location.origin}/api/download/install.bat?token=${enrollment.enrollToken}`}
              className="flex items-center justify-center gap-2 w-full py-3 bg-teal-500 hover:bg-teal-400 text-gray-950 rounded-lg font-medium transition"
            >
              Download Installer (.bat)
            </a>

            <p className="text-xs text-gray-500">
              Double-click the downloaded file to install. No Python or other software needed.
            </p>

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer hover:text-gray-400">Or copy PowerShell command</summary>
              <div className="relative mt-2">
                <pre className="bg-gray-950 border border-gray-800/50 rounded-lg p-3 pr-12 font-mono text-teal-400 overflow-x-auto whitespace-pre-wrap break-all">
                  {`irm ${window.location.origin}/api/download/install.ps1?token=${enrollment.enrollToken} | iex`}
                </pre>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-gray-400 hover:text-white"
                  onClick={() => handleCopy(
                    `irm ${window.location.origin}/api/download/install.ps1?token=${enrollment.enrollToken} | iex`
                  )}
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </details>

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
