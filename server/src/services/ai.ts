import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { executeAgentCommand } from './agentBridge.js';
import { prisma } from '../db.js';
import { logger } from '../index.js';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

const activeLoops = new Map<string, { cancel: boolean; abortController?: AbortController }>();

export function isAIBusy(computerId: string): boolean {
  return activeLoops.has(computerId);
}

export function cancelAILoop(computerId: string): boolean {
  const loop = activeLoops.get(computerId);
  if (loop) {
    loop.cancel = true;
    loop.abortController?.abort();
    return true;
  }
  return false;
}

const tools: Anthropic.Tool[] = [
  {
    name: "execute_command",
    description: "Execute a shell command on the remote computer. Use PowerShell for Windows. Returns stdout, stderr, and exit code.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "The command to execute" },
        shell: { type: "string", enum: ["powershell", "cmd"], description: "Shell to use (default: powershell)" },
        timeout: { type: "number", description: "Timeout in seconds (default 30, max 120)" },
      },
      required: ["command"],
    },
  },
  {
    name: "screenshot",
    description: "Capture a screenshot of the remote screen. Returns the image. Use this to see what's on screen, verify UI state, or check error dialogs.",
    input_schema: {
      type: "object" as const,
      properties: {
        monitor: { type: "number", description: "Monitor index (0 = primary)" },
      },
    },
  },
  {
    name: "get_event_logs",
    description: "Read Windows Event Viewer logs to diagnose errors, crashes, and system issues.",
    input_schema: {
      type: "object" as const,
      properties: {
        log_name: { type: "string", enum: ["System", "Application", "Security", "Setup"], description: "Which log to query" },
        level: { type: "string", enum: ["Error", "Warning", "Critical", "Information"], description: "Filter by severity" },
        last_n: { type: "number", description: "Number of recent entries (default 20, max 100)" },
        hours_back: { type: "number", description: "Only entries from last N hours" },
      },
      required: ["log_name"],
    },
  },
  {
    name: "system_info",
    description: "Get detailed system information: OS, CPU, RAM usage, disk space, network config, uptime.",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "list_processes",
    description: "List running processes with CPU and memory usage.",
    input_schema: {
      type: "object" as const,
      properties: {
        sort_by: { type: "string", enum: ["cpu", "memory", "name"], description: "Sort order" },
        top_n: { type: "number", description: "Return top N processes (default 30)" },
      },
    },
  },
  {
    name: "manage_service",
    description: "Start, stop, restart, or check status of a Windows service.",
    input_schema: {
      type: "object" as const,
      properties: {
        service_name: { type: "string", description: "Service name" },
        action: { type: "string", enum: ["start", "stop", "restart", "status"], description: "Action" },
      },
      required: ["service_name", "action"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file on the remote computer.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Full file path" },
        max_lines: { type: "number", description: "Max lines to return (default 200)" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file on the remote computer. Blocked for system directories.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Full file path" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "network_diagnostics",
    description: "Run network diagnostics: ping, traceroute, DNS lookup, or check if a port is open.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: { type: "string", enum: ["ping", "traceroute", "nslookup", "port_check"], description: "Action" },
        target: { type: "string", description: "Target hostname or IP" },
        port: { type: "number", description: "Port number (for port_check)" },
      },
      required: ["action", "target"],
    },
  },
  {
    name: "get_installed_software",
    description: "List installed software with version numbers. Optionally filter by name.",
    input_schema: {
      type: "object" as const,
      properties: {
        filter: { type: "string", description: "Optional name filter (case-insensitive)" },
      },
    },
  },
];

function buildSystemPrompt(computer: { name: string; hostname: string; os: string; cpuModel: string | null; ramTotalMb: number | null }): string {
  return `You are Pulse AI, an expert IT support assistant. You are connected to a remote computer and can execute commands, take screenshots, read logs, and manage services on it.

Computer info:
- Name: ${computer.name}
- Hostname: ${computer.hostname}
- OS: ${computer.os}
- CPU: ${computer.cpuModel || 'Unknown'}
- RAM: ${computer.ramTotalMb || 'Unknown'} MB

Your goal is to diagnose and fix issues the user describes. Follow these principles:

1. DIAGNOSE FIRST: Before making changes, gather information. Run diagnostic commands, check logs, take screenshots.
2. EXPLAIN WHAT YOU FIND: Tell the user what you discovered in plain language.
3. WORK STEP BY STEP: Complex issues may require multiple diagnostic steps. Work methodically.
4. VERIFY FIXES: After applying a fix, verify it worked.
5. USE POWERSHELL: This is a Windows computer. Use PowerShell commands.
6. DESCRIBE SCREENSHOTS: When you take a screenshot, describe what you see in detail.
7. STAY SAFE: Never run commands that could cause data loss. The agent has a safety blocklist but use good judgment.
8. ACT AUTONOMOUSLY: Diagnose and fix issues without asking for permission. Just do it and report what you did.`;
}

export type StreamCallback = (event: {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'cancelled';
  data?: any;
}) => void;

export async function runAIChat(
  computerId: string,
  userMessage: string,
  onStream: StreamCallback,
): Promise<void> {
  if (activeLoops.has(computerId)) {
    onStream({ type: 'error', data: 'AI is already working on this computer.' });
    return;
  }

  const loopState: { cancel: boolean; abortController?: AbortController } = { cancel: false };
  activeLoops.set(computerId, loopState);

  try {
    const computer = await prisma.computer.findUnique({ where: { id: computerId } });
    if (!computer) {
      onStream({ type: 'error', data: 'Computer not found.' });
      return;
    }

    // Load conversation history from DB
    const dbMessages = await prisma.chatMessage.findMany({
      where: { computerId },
      orderBy: { createdAt: 'asc' },
    });

    const messages: Anthropic.MessageParam[] = [];
    for (const msg of dbMessages) {
      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'assistant') {
        try {
          messages.push({ role: 'assistant', content: JSON.parse(msg.content) });
        } catch {
          messages.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool_result') {
        try {
          messages.push({ role: 'user', content: JSON.parse(msg.content) });
        } catch {
          messages.push({ role: 'user', content: msg.content });
        }
      }
    }

    // Sanitize: remove trailing assistant messages with tool_use that lack tool_result
    while (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant' && Array.isArray(last.content)) {
        const hasToolUse = last.content.some((b: any) => b.type === 'tool_use');
        if (hasToolUse) {
          messages.pop();
          continue;
        }
      }
      break;
    }

    // Context window management
    const MAX_CONTEXT_CHARS = 100000;
    let totalChars = messages.reduce((sum, m) => sum + JSON.stringify(m.content).length, 0);
    if (totalChars > MAX_CONTEXT_CHARS) {
      for (let i = 0; i < messages.length && totalChars > MAX_CONTEXT_CHARS; i++) {
        const msg = messages[i];
        const content = JSON.stringify(msg.content);
        if (msg.role === 'user' && content.length > 1000 && content.includes('tool_result')) {
          try {
            const parsed = JSON.parse(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content));
            if (Array.isArray(parsed)) {
              for (const block of parsed) {
                if (block.type === 'tool_result' && typeof block.content === 'string' && block.content.length > 500) {
                  const oldLen = block.content.length;
                  block.content = block.content.slice(0, 500) + '\n[TRUNCATED for context window]';
                  totalChars -= (oldLen - block.content.length);
                }
              }
              messages[i] = { role: 'user', content: parsed };
            }
          } catch {}
        }
      }
    }

    // Add the new user message
    messages.push({ role: 'user', content: userMessage });
    await prisma.chatMessage.create({
      data: { computerId, role: 'user', content: userMessage },
    });

    // Agentic loop
    let iterations = 0;
    const maxIterations = 20;

    while (iterations++ < maxIterations) {
      if (loopState.cancel) {
        onStream({ type: 'cancelled' });
        await prisma.chatMessage.create({
          data: { computerId, role: 'assistant', content: '[AI loop cancelled by user]' },
        });
        return;
      }

      const abortController = new AbortController();
      loopState.abortController = abortController;

      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: buildSystemPrompt(computer),
        tools,
        messages,
      }, { signal: abortController.signal });

      // Stream text tokens in real-time
      stream.on('text', (text) => {
        onStream({ type: 'text', data: text });
      });

      const response = await stream.finalMessage();

      await prisma.chatMessage.create({
        data: {
          computerId,
          role: 'assistant',
          content: JSON.stringify(response.content),
        },
      });

      // Emit tool calls after response completes
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          onStream({
            type: 'tool_call',
            data: { id: block.id, name: block.name, input: block.input },
          });
        }
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) {
        onStream({ type: 'done' });
        return;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        if (loopState.cancel) {
          onStream({ type: 'cancelled' });
          return;
        }

        try {
          const result = await executeAgentCommand(
            computerId,
            toolUse.name,
            toolUse.input as Record<string, any>,
          );

          if (toolUse.name === 'screenshot' && result.image_base64) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: result.image_base64,
                  },
                },
              ],
            });
            onStream({
              type: 'tool_result',
              data: {
                tool_use_id: toolUse.id,
                is_screenshot: true,
                image_base64: result.image_base64,
                width: result.width,
                height: result.height,
              },
            });
          } else {
            const resultText = JSON.stringify(result, null, 2);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: resultText,
            });
            onStream({
              type: 'tool_result',
              data: { tool_use_id: toolUse.id, content: resultText },
            });
          }
        } catch (err: any) {
          const errorMsg = err.message || 'Command execution failed';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: errorMsg,
            is_error: true,
          });
          onStream({
            type: 'tool_result',
            data: { tool_use_id: toolUse.id, content: errorMsg, is_error: true },
          });
        }
      }

      const toolResultMessage: Anthropic.MessageParam = {
        role: 'user',
        content: toolResults,
      };
      messages.push({ role: 'assistant', content: response.content });
      messages.push(toolResultMessage);

      await prisma.chatMessage.create({
        data: {
          computerId,
          role: 'tool_result',
          content: JSON.stringify(toolResults),
        },
      });
    }

    onStream({ type: 'text', data: '\n\n*Reached maximum diagnostic steps. Please start a new session if the issue is unresolved.*' });
    onStream({ type: 'done' });

  } catch (err: any) {
    logger.error({ err: err.message, status: err.status }, 'AI loop error');
    onStream({ type: 'error', data: err.message || 'AI error' });
  } finally {
    activeLoops.delete(computerId);
  }
}
