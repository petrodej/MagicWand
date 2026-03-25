import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Loader2, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, getWsBase } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChatMessage } from './ChatMessage';
import { ToolCallDisplay } from './ToolCallDisplay';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant' | 'tool_result';
  content: string;
  createdAt: string;
}

interface Props {
  computerId: string;
  isOnline: boolean;
}

export function AIChat({ computerId, isOnline }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingContent, setStreamingContent] = useState<any[]>([]);
  const [toolResults, setToolResults] = useState<Map<string, any>>(new Map());
  const [pendingTools, setPendingTools] = useState<Set<string>>(new Set());
  const [wsToken, setWsToken] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ token: string }>('/api/auth/ws-token').then((d) => setWsToken(d.token));
    api.get<ChatMsg[]>(`/api/computers/${computerId}/chat`).then(setMessages);
  }, [computerId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, toolResults]);

  const wsUrl = wsToken
    ? `${getWsBase()}/ws/chat/${computerId}?token=${wsToken}`
    : '';

  const handleWsMessage = useCallback((event: any) => {
    switch (event.type) {
      case 'text':
        setStreamingContent((prev) => [...prev, { type: 'text', text: event.data }]);
        break;

      case 'tool_call':
        setStreamingContent((prev) => [...prev, { type: 'tool_use', id: event.data.id, name: event.data.name, input: event.data.input }]);
        setPendingTools((prev) => new Set(prev).add(event.data.id));
        break;

      case 'tool_result':
        setPendingTools((prev) => {
          const next = new Set(prev);
          next.delete(event.data.tool_use_id);
          return next;
        });
        setToolResults((prev) => new Map(prev).set(event.data.tool_use_id, event.data));
        break;

      case 'done':
      case 'cancelled':
        setBusy(false);
        setStreamingContent([]);
        setToolResults(new Map());
        setPendingTools(new Set());
        api.get<ChatMsg[]>(`/api/computers/${computerId}/chat`).then(setMessages);
        break;

      case 'error':
        setBusy(false);
        setStreamingContent([]);
        break;
    }
  }, [computerId]);

  useWebSocket({ url: wsUrl, enabled: !!wsToken, onMessage: handleWsMessage });

  const sendMessage = async (text: string) => {
    if (!text.trim() || busy || !isOnline) return;
    setInput('');
    setBusy(true);
    setStreamingContent([]);
    setToolResults(new Map());

    setMessages((prev) => [...prev, {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    } as ChatMsg]);

    try {
      await api.post(`/api/computers/${computerId}/chat`, { message: text });
    } catch (err: any) {
      setBusy(false);
      setMessages((prev) => [...prev, {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        role: 'assistant',
        content: `**Error:** ${err.message || 'Failed to send message'}`,
        createdAt: new Date().toISOString(),
      } as ChatMsg]);
    }
  };

  const clearChat = async () => {
    await api.del(`/api/computers/${computerId}/chat`);
    setMessages([]);
    setStreamingContent([]);
  };

  const cancelAI = async () => {
    await api.del(`/api/computers/${computerId}/chat/active`);
  };

  const quickActions = [
    { label: 'Check system health', prompt: 'Run a full system health check — CPU, RAM, disk, and recent errors.' },
    { label: 'Find recent errors', prompt: 'Check the Windows Event Viewer for recent errors and tell me what you find.' },
    { label: 'List running processes', prompt: 'Show me the top processes by memory and CPU usage.' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.filter((m) => m.role !== 'tool_result').map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role as 'user' | 'assistant'}
            content={msg.content}
          />
        ))}

        {streamingContent.length > 0 && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-xl rounded-bl-sm max-w-[80%]">
              {streamingContent.map((block, i) => {
                if (block.type === 'text') {
                  return (
                    <div key={i} className="text-sm prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{block.text}</ReactMarkdown>
                    </div>
                  );
                }
                if (block.type === 'tool_use') {
                  return (
                    <ToolCallDisplay
                      key={i}
                      name={block.name}
                      input={block.input}
                      result={toolResults.get(block.id)}
                      loading={pendingTools.has(block.id)}
                    />
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {busy && streamingContent.length === 0 && (
          <div className="flex items-center gap-2 text-gray-500 text-sm ml-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-gray-800 p-4">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder={isOnline ? 'Ask MagicWand to fix something...' : 'Computer is offline'}
            disabled={!isOnline || busy}
            className="bg-gray-900 border-gray-700"
          />
          {busy ? (
            <Button variant="destructive" size="icon" onClick={cancelAI}>
              <X className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || !isOnline}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-gray-500" onClick={clearChat} title="New session">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {messages.length === 0 && !busy && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => sendMessage(qa.prompt)}
                disabled={!isOnline}
                className="px-3 py-1.5 bg-gray-900 border border-gray-800 rounded-full text-xs text-gray-400 hover:text-white hover:border-gray-600 transition"
              >
                {qa.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
