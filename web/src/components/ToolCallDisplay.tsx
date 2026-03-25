import { useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface ToolCallProps {
  name: string;
  input: any;
  result?: {
    content?: string;
    is_error?: boolean;
    is_screenshot?: boolean;
    image_base64?: string;
  };
  loading?: boolean;
}

export function ToolCallDisplay({ name, input, result, loading }: ToolCallProps) {
  const [expanded, setExpanded] = useState(false);

  const icon = loading ? (
    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
  ) : result?.is_error ? (
    <XCircle className="w-3 h-3 text-red-400" />
  ) : (
    <CheckCircle className="w-3 h-3 text-green-400" />
  );

  const inputSummary = name === 'execute_command'
    ? input.command
    : name === 'screenshot'
    ? 'Capturing screen...'
    : JSON.stringify(input).slice(0, 80);

  return (
    <div className="bg-gray-950 border border-gray-800 rounded-md my-2 overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-900"
        onClick={() => setExpanded(!expanded)}
      >
        {icon}
        <span className="font-mono text-xs text-blue-400">{name}</span>
        <span className="text-xs text-gray-500 truncate flex-1">{inputSummary}</span>
        {expanded ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
      </div>

      {expanded && (
        <div className="border-t border-gray-800 px-3 py-2">
          <div className="text-xs text-gray-500 mb-1">Input:</div>
          <pre className="text-xs text-gray-400 font-mono mb-2 whitespace-pre-wrap break-all max-h-32 overflow-auto">
            {JSON.stringify(input, null, 2)}
          </pre>

          {result && (
            <>
              <div className="text-xs text-gray-500 mb-1">Result:</div>
              {result.is_screenshot && result.image_base64 ? (
                <img
                  src={`data:image/jpeg;base64,${result.image_base64}`}
                  alt="Screenshot"
                  className="max-w-full rounded border border-gray-700"
                />
              ) : (
                <pre className={`text-xs font-mono whitespace-pre-wrap break-all max-h-64 overflow-auto ${
                  result.is_error ? 'text-red-400' : 'text-gray-400'
                }`}>
                  {result.content}
                </pre>
              )}
            </>
          )}

          {loading && <div className="text-xs text-gray-500">Running...</div>}
        </div>
      )}
    </div>
  );
}
