import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="ml-60 flex-1 min-h-screen">{children}</main>
    </div>
  );
}
