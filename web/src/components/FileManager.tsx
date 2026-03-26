import { useState, useEffect, useCallback } from 'react';
import {
  Folder, File, ArrowUp, RefreshCw, Download, Upload, Trash2, FolderPlus,
  Loader2, HardDrive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '../lib/api';

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  modified: string;
  error?: string;
}

interface ListResult {
  path: string;
  entries: FileEntry[];
  parent: string | null;
  error?: string;
}

interface Props {
  computerId: string;
  isOnline: boolean;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FileManager({ computerId, isOnline }: Props) {
  const [currentPath, setCurrentPath] = useState('C:\\');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('C:\\');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.post<ListResult>(`/api/computers/${computerId}/files/list`, { path });
      if (result.error) {
        setError(result.error);
        setEntries([]);
      } else {
        setEntries(result.entries);
        setCurrentPath(result.path);
        setPathInput(result.path);
        setParentPath(result.parent);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
    } finally {
      setLoading(false);
    }
  }, [computerId]);

  useEffect(() => {
    if (isOnline) loadDirectory('C:\\');
  }, [isOnline, loadDirectory]);

  const navigate = (path: string) => {
    loadDirectory(path);
  };

  const goUp = () => {
    if (parentPath) loadDirectory(parentPath);
  };

  const handlePathSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') loadDirectory(pathInput);
  };

  const handleDownload = async (entry: FileEntry) => {
    setActionLoading(entry.path);
    try {
      const result = await api.post<{ data_base64: string; name: string; error?: string }>(
        `/api/computers/${computerId}/files/download`, { path: entry.path }
      );
      if (result.error) {
        alert(result.error);
        return;
      }
      // Convert base64 to blob and trigger download
      const bytes = atob(result.data_base64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      const blob = new Blob([arr]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Download failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setActionLoading('upload');
      try {
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = (reader.result as string).split(',')[1];
          const destPath = currentPath + (currentPath.endsWith('\\') ? '' : '\\') + file.name;
          const result = await api.post<{ success?: boolean; error?: string }>(
            `/api/computers/${computerId}/files/upload`,
            { path: destPath, data_base64: base64 }
          );
          if (result.error) {
            alert(result.error);
          } else {
            loadDirectory(currentPath);
          }
          setActionLoading(null);
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        alert(err.message || 'Upload failed');
        setActionLoading(null);
      }
    };
    input.click();
  };

  const handleDelete = async (entry: FileEntry) => {
    if (!confirm(`Delete ${entry.isDir ? 'folder' : 'file'} "${entry.name}"?`)) return;
    setActionLoading(entry.path);
    try {
      const result = await api.post<{ success?: boolean; error?: string }>(
        `/api/computers/${computerId}/files/delete`, { path: entry.path }
      );
      if (result.error) {
        alert(result.error);
      } else {
        loadDirectory(currentPath);
      }
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath + (currentPath.endsWith('\\') ? '' : '\\') + newFolderName.trim();
    setActionLoading('mkdir');
    try {
      const result = await api.post<{ success?: boolean; error?: string }>(
        `/api/computers/${computerId}/files/mkdir`, { path: folderPath }
      );
      if (result.error) {
        alert(result.error);
      } else {
        setShowNewFolder(false);
        setNewFolderName('');
        loadDirectory(currentPath);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create folder');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOnline) {
    return (
      <div className="text-gray-600 py-12 text-center text-sm">
        Computer is offline. File manager unavailable.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
        <Button variant="ghost" size="sm" onClick={goUp} disabled={!parentPath}
          className="text-gray-400 hover:text-teal-400">
          <ArrowUp className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1 flex-1">
          <HardDrive className="w-4 h-4 text-gray-500 shrink-0" />
          <Input
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={handlePathSubmit}
            className="bg-gray-900 border-gray-800 text-sm font-mono h-8"
          />
        </div>

        <Button variant="ghost" size="sm" onClick={() => loadDirectory(currentPath)}
          className="text-gray-400 hover:text-teal-400">
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowNewFolder(!showNewFolder)}
          className="text-gray-400 hover:text-teal-400">
          <FolderPlus className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleUpload}
          disabled={actionLoading === 'upload'}
          className="text-gray-400 hover:text-teal-400">
          {actionLoading === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
      </div>

      {/* New folder input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            placeholder="New folder name"
            className="bg-gray-900 border-gray-800 text-sm h-8"
            autoFocus
          />
          <Button size="sm" onClick={handleCreateFolder}
            disabled={actionLoading === 'mkdir'}
            className="bg-teal-500 hover:bg-teal-400 text-gray-950 text-xs h-8">
            Create
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}
            className="text-gray-500 h-8 text-xs">
            Cancel
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-red-400 text-sm mb-3 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto border border-gray-800/50 rounded-lg">
        {/* Header */}
        <div className="grid grid-cols-[1fr_100px_160px_40px] gap-2 px-3 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800/50 sticky top-0 bg-gray-950">
          <span>Name</span>
          <span className="text-right">Size</span>
          <span>Modified</span>
          <span></span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-gray-600 text-sm text-center py-12">Empty directory</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.path}
              className={`grid grid-cols-[1fr_100px_160px_40px] gap-2 px-3 py-1.5 text-sm hover:bg-gray-800/30 group ${
                entry.isDir ? 'cursor-pointer' : ''
              }`}
              onDoubleClick={() => entry.isDir && navigate(entry.path)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {entry.isDir ? (
                  <Folder className="w-4 h-4 text-teal-400 shrink-0" />
                ) : (
                  <File className="w-4 h-4 text-gray-500 shrink-0" />
                )}
                <span
                  className={`truncate ${entry.isDir ? 'text-gray-100' : 'text-gray-400'} ${entry.error ? 'text-gray-600 italic' : ''}`}
                  onClick={() => entry.isDir && navigate(entry.path)}
                >
                  {entry.name}
                </span>
              </div>
              <span className="text-gray-500 text-xs text-right self-center">
                {entry.isDir ? '—' : formatSize(entry.size)}
              </span>
              <span className="text-gray-600 text-xs self-center">
                {formatDate(entry.modified)}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!entry.isDir && (
                  <button
                    onClick={() => handleDownload(entry)}
                    disabled={actionLoading === entry.path}
                    className="text-gray-500 hover:text-teal-400"
                  >
                    {actionLoading === entry.path ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <button
                  onClick={() => handleDelete(entry)}
                  disabled={actionLoading === entry.path}
                  className="text-gray-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
