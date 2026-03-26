import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Monitor, Code2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { Computer } from '../stores/computerStore';

interface Script {
  id: string;
  name: string;
  description: string;
}

interface SearchResult {
  type: 'computer' | 'script' | 'page';
  id: string;
  title: string;
  subtitle: string;
  path: string;
}

const PAGES: SearchResult[] = [
  { type: 'page', id: 'dashboard', title: 'Dashboard', subtitle: 'Computer overview', path: '/dashboard' },
  { type: 'page', id: 'alerts', title: 'Alerts', subtitle: 'Alert rules and logs', path: '/alerts' },
  { type: 'page', id: 'audit', title: 'Audit Log', subtitle: 'Action history', path: '/audit' },
  { type: 'page', id: 'scheduled', title: 'Scheduled Tasks', subtitle: 'Cron jobs', path: '/scheduled' },
  { type: 'page', id: 'scripts', title: 'Script Library', subtitle: 'Saved scripts', path: '/scripts' },
  { type: 'page', id: 'settings', title: 'User Management', subtitle: 'Admin settings', path: '/settings' },
];

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load data when opening
  useEffect(() => {
    if (open) {
      api.get<Computer[]>('/api/computers').then(setComputers).catch(() => {});
      api.get<Script[]>('/api/scripts').then(setScripts).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Filter results
  useEffect(() => {
    if (!query.trim()) {
      setResults(PAGES);
      setSelectedIdx(0);
      return;
    }

    const q = query.toLowerCase();
    const matched: SearchResult[] = [];

    // Computers
    for (const c of computers) {
      if (
        c.hostname?.toLowerCase().includes(q) ||
        c.name?.toLowerCase().includes(q) ||
        c.os?.toLowerCase().includes(q) ||
        c.ipAddress?.toLowerCase().includes(q) ||
        c.tags?.toLowerCase().includes(q)
      ) {
        matched.push({
          type: 'computer',
          id: c.id,
          title: c.hostname || c.name,
          subtitle: `${c.os} ${c.ipAddress ? '· ' + c.ipAddress : ''}`,
          path: `/computers/${c.id}`,
        });
      }
    }

    // Scripts
    for (const s of scripts) {
      if (s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) {
        matched.push({
          type: 'script',
          id: s.id,
          title: s.name,
          subtitle: s.description || 'Script',
          path: '/scripts',
        });
      }
    }

    // Pages
    for (const p of PAGES) {
      if (p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)) {
        matched.push(p);
      }
    }

    setResults(matched.slice(0, 15));
    setSelectedIdx(0);
  }, [query, computers, scripts]);

  const go = useCallback((result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
    setQuery('');
  }, [navigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      go(results[selectedIdx]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 border-b border-gray-800/50">
          <Search className="w-4 h-4 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search computers, scripts, pages..."
            className="flex-1 py-3 bg-transparent text-sm text-gray-200 outline-none placeholder-gray-600"
          />
          <kbd className="text-[10px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-600 text-sm">No results</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => go(r)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIdx ? 'bg-gray-800/50' : ''
                }`}
              >
                <div className="shrink-0">
                  {r.type === 'computer' ? (
                    <Monitor className="w-4 h-4 text-teal-500" />
                  ) : r.type === 'script' ? (
                    <Code2 className="w-4 h-4 text-purple-400" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-gray-200 truncate">{r.title}</div>
                  <div className="text-xs text-gray-500 truncate">{r.subtitle}</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-800/50 flex items-center gap-4 text-[10px] text-gray-600">
          <span><kbd className="bg-gray-800 px-1 py-0.5 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-gray-800 px-1 py-0.5 rounded">↵</kbd> select</span>
          <span><kbd className="bg-gray-800 px-1 py-0.5 rounded">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
