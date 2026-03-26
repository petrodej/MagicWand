import { useState, useEffect, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api, getWsBase } from '../lib/api';

const QUALITY_PRESETS = [
  { label: 'Low', quality: 25, maxWidth: 960, fps: 15, desc: 'Fast, low res' },
  { label: 'Medium', quality: 50, maxWidth: 1280, fps: 10, desc: 'Balanced' },
  { label: 'High', quality: 75, maxWidth: 1600, fps: 6, desc: 'Sharper image' },
  { label: 'Ultra', quality: 90, maxWidth: 1920, fps: 4, desc: 'Best quality' },
];

interface Props {
  computerId: string;
  isOnline: boolean;
}

export function RemoteDesktop({ computerId, isOnline }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [frameSize, setFrameSize] = useState({ width: 1280, height: 720 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showQuality, setShowQuality] = useState(false);
  const [qualityPreset, setQualityPreset] = useState(1); // default Medium
  const containerRef = useRef<HTMLDivElement>(null);

  // Track fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Connect WebSocket
  useEffect(() => {
    if (!isOnline) return;

    let alive = true;
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let backoff = 1000;

    async function connect() {
      if (!alive) return;
      try {
        const { token } = await api.get<{ token: string }>('/api/auth/ws-token');
        if (!alive) return;

        ws = new WebSocket(`${getWsBase()}/ws/remote/${computerId}?token=${token}`);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          backoff = 1000;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'frame') {
              drawFrame(data.data, data.width, data.height);
              setFrameSize({ width: data.width, height: data.height });
            } else if (data.type === 'error') {
              console.error('Remote desktop error:', data.message);
            }
          } catch {}
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (alive) {
            reconnectTimeout = setTimeout(connect, backoff);
            backoff = Math.min(backoff * 2, 30000);
          }
        };
      } catch {
        if (alive) {
          reconnectTimeout = setTimeout(connect, backoff);
          backoff = Math.min(backoff * 2, 30000);
        }
      }
    }

    connect();

    return () => {
      alive = false;
      clearTimeout(reconnectTimeout);
      ws?.close();
      wsRef.current = null;
    };
  }, [computerId, isOnline]);

  // Draw frame on canvas
  const drawFrame = useCallback((base64: string, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  }, []);

  // Send input event
  const sendInput = useCallback((event: Record<string, any>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', ...event }));
    }
  }, []);

  // Send quality settings
  const applyQuality = useCallback((presetIndex: number) => {
    setQualityPreset(presetIndex);
    setShowQuality(false);
    const preset = QUALITY_PRESETS[presetIndex];
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'settings',
        quality: preset.quality,
        maxWidth: preset.maxWidth,
        fps: preset.fps,
      }));
    }
  }, []);

  // Calculate coordinates relative to the frame
  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (frameSize.width / rect.width);
    const y = (e.clientY - rect.top) * (frameSize.height / rect.height);
    return { x: Math.round(x), y: Math.round(y) };
  }, [frameSize]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const { x, y } = getCoords(e);
    const button = e.button === 2 ? 'right' : 'left';
    sendInput({ action: 'mouse_click', x, y, button });
  }, [getCoords, sendInput]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const { x, y } = getCoords(e);
    sendInput({ action: 'mouse_move', x, y });
  }, [isDragging, getCoords, sendInput]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e);
    sendInput({ action: 'mouse_double_click', x, y });
  }, [getCoords, sendInput]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e as unknown as React.MouseEvent<HTMLCanvasElement>);
    const delta = e.deltaY > 0 ? -3 : 3;
    sendInput({ action: 'mouse_scroll', x, y, delta });
  }, [getCoords, sendInput]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  }, []);

  // Keyboard handlers
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLCanvasElement>) => {
    e.preventDefault();

    // Handle modifier combos
    const modifiers: string[] = [];
    if (e.ctrlKey) modifiers.push('ctrl');
    if (e.altKey) modifiers.push('alt');
    if (e.shiftKey) modifiers.push('shift');
    if (e.metaKey) modifiers.push('win');

    const key = e.key.toLowerCase();

    // Skip standalone modifier keys
    if (['control', 'alt', 'shift', 'meta'].includes(key)) return;

    if (modifiers.length > 0) {
      sendInput({ action: 'key_combo', keys: [...modifiers, key] });
    } else {
      const keyMap: Record<string, string> = {
        'enter': 'enter', 'backspace': 'backspace', 'tab': 'tab',
        'escape': 'escape', 'delete': 'delete', 'arrowup': 'up',
        'arrowdown': 'down', 'arrowleft': 'left', 'arrowright': 'right',
        ' ': 'space', 'home': 'home', 'end': 'end',
        'pageup': 'pageup', 'pagedown': 'pagedown',
      };
      const mappedKey = keyMap[key] || key;
      sendInput({ action: 'key_press', key: mappedKey });
    }
  }, [sendInput]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  }, []);

  // Send Ctrl+Alt+Del
  const sendCtrlAltDel = useCallback(() => {
    sendInput({ action: 'key_combo', keys: ['ctrl', 'alt', 'delete'] });
  }, [sendInput]);

  if (!isOnline) {
    return (
      <div className="text-gray-600 py-12 text-center text-sm">
        Computer is offline. Remote desktop unavailable.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-900 border-b border-gray-800/50 px-4 py-2 rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-gray-600'
            }`} />
            <span className="text-gray-400">
              {connected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Quality selector */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQuality(!showQuality)}
              className="text-gray-400 hover:text-teal-400 text-xs gap-1"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {QUALITY_PRESETS[qualityPreset].label}
            </Button>
            {showQuality && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-gray-800/50 rounded-lg shadow-xl z-50 py-1 w-44">
                {QUALITY_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => applyQuality(i)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      qualityPreset === i
                        ? 'bg-teal-500/10 text-teal-400'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-xs">{preset.label}</div>
                      <div className="text-[10px] text-gray-600">{preset.desc}</div>
                    </div>
                    <span className="text-[10px] text-gray-600">{preset.fps} FPS</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={sendCtrlAltDel}
            className="text-gray-400 hover:text-teal-400 text-xs"
          >
            Ctrl+Alt+Del
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-teal-400"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Canvas container */}
      <div className="flex-1 bg-gray-950 flex items-center justify-center overflow-hidden">
        {!connected ? (
          <div className="flex items-center gap-2 text-gray-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Connecting to remote desktop...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            tabIndex={0}
            className="max-w-full max-h-full cursor-default outline-none focus:ring-2 focus:ring-teal-500/30 rounded"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onDoubleClick={handleDoubleClick}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>
    </div>
  );
}
