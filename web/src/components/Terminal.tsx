import { useState, useRef, useEffect, useCallback } from 'react';
import { Loader2, Terminal as TerminalIcon } from 'lucide-react';
import { api } from '../lib/api';

interface Props {
  computerId: string;
  isOnline: boolean;
}

interface HistoryEntry {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export function Terminal({ computerId, isOnline }: Props) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState('C:\\');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, running]);

  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim() || running) return;

    setInput('');
    setRunning(true);
    setCmdHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);

    // Handle cd command locally to track cwd
    let fullCommand = command;
    if (command.trim().toLowerCase() === 'cls' || command.trim().toLowerCase() === 'clear') {
      setHistory([]);
      setRunning(false);
      return;
    }

    // Prepend cd to cwd before each command so we maintain directory context
    fullCommand = `Set-Location '${cwd}'; ${command}; (Get-Location).Path`;

    try {
      const execResult = await api.post<{
        stdout: string;
        stderr: string;
        exit_code: number;
      }>(`/api/computers/${computerId}/execute`, {
        command: fullCommand,
        shell: 'powershell',
        timeout: 30,
      });

      // Extract new cwd from last line of stdout
      const lines = (execResult.stdout || '').split('\n').map(l => l.trim()).filter(Boolean);
      const lastLine = lines[lines.length - 1] || '';
      if (lastLine.match(/^[A-Z]:\\/i) || lastLine.match(/^\//)) {
        setCwd(lastLine);
        lines.pop();
      }

      setHistory((prev) => [...prev, {
        command,
        stdout: lines.join('\n'),
        stderr: execResult.stderr || '',
        exitCode: execResult.exit_code,
      }]);
    } catch (err: any) {
      setHistory((prev) => [...prev, {
        command,
        stdout: '',
        stderr: err.message || 'Command failed',
        exitCode: -1,
      }]);
    } finally {
      setRunning(false);
      inputRef.current?.focus();
    }
  }, [computerId, cwd, running]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const newIndex = historyIndex === -1 ? cmdHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(cmdHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= cmdHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(cmdHistory[newIndex]);
        }
      }
    }
  };

  if (!isOnline) {
    return (
      <div className="text-gray-600 py-12 text-center text-sm">
        Computer is offline. Terminal unavailable.
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-[calc(100vh-180px)] bg-gray-950 border border-gray-800/50 rounded-lg font-mono text-sm"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800/50">
        <TerminalIcon className="w-4 h-4 text-teal-400" />
        <span className="text-gray-400 text-xs">PowerShell — {cwd}</span>
      </div>

      {/* Output area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {history.map((entry, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 text-teal-400">
              <span className="text-gray-500">PS {cwd}&gt;</span>
              <span>{entry.command}</span>
            </div>
            {entry.stdout && (
              <pre className="text-gray-300 whitespace-pre-wrap mt-1 ml-0">{entry.stdout}</pre>
            )}
            {entry.stderr && (
              <pre className="text-red-400 whitespace-pre-wrap mt-1 ml-0">{entry.stderr}</pre>
            )}
          </div>
        ))}

        {running && (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-3 h-3 animate-spin" /> Running...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-2 border-t border-gray-800/50">
        <span className="text-gray-500 text-xs shrink-0">PS {cwd}&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={running}
          className="flex-1 bg-transparent text-gray-100 outline-none placeholder:text-gray-700"
          placeholder="Type a command..."
          autoFocus
        />
      </div>
    </div>
  );
}
