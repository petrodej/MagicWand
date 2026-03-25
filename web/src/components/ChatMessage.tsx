import ReactMarkdown from 'react-markdown';
import { ToolCallDisplay } from './ToolCallDisplay';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  toolResults?: Map<string, any>;
  pendingTools?: Set<string>;
}

export function ChatMessage({ role, content, toolResults, pendingTools }: MessageProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-purple-600 px-4 py-2.5 rounded-xl rounded-br-sm max-w-[70%] text-sm">
          {content}
        </div>
      </div>
    );
  }

  let blocks: any[];
  try {
    blocks = JSON.parse(content);
    if (!Array.isArray(blocks)) blocks = [{ type: 'text', text: content }];
  } catch {
    blocks = [{ type: 'text', text: content }];
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-xl rounded-bl-sm max-w-[80%]">
        {blocks.map((block: any, i: number) => {
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
                result={toolResults?.get(block.id)}
                loading={pendingTools?.has(block.id)}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
