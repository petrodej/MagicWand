export function StatusIndicator({ online }: { online: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`w-2 h-2 rounded-full ${
          online
            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]'
            : 'bg-red-500'
        }`}
      />
      <span className={`text-xs ${online ? 'text-green-500' : 'text-red-500'}`}>
        {online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
