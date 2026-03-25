# Enterprise UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the MagicWand frontend from prototype to clean, minimal enterprise SaaS aesthetic with teal accent and sidebar navigation.

**Architecture:** Pure frontend restyling. No backend changes. Create a Sidebar component, wrap authenticated pages in a layout with sidebar, restyle all existing components to match the teal/dark/minimal spec. The app uses React + Tailwind CSS 4 + @base-ui/react + Lucide icons + Geist font.

**Tech Stack:** React 19, Tailwind CSS 4, @base-ui/react, Lucide React, Geist Variable font

**Spec:** `docs/superpowers/specs/2026-03-25-enterprise-ui-redesign.md`

---

### Task 1: Create Sidebar Component + App Layout

**Files:**
- Create: `web/src/components/Sidebar.tsx`
- Create: `web/src/components/AppLayout.tsx`
- Modify: `web/src/App.tsx`

The sidebar is the foundation of the new layout. Create it first, then wrap all authenticated routes in an AppLayout that renders sidebar + main content area.

- [ ] **Step 1: Create `web/src/components/Sidebar.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Monitor, PanelLeftClose, PanelLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside className={`fixed top-0 left-0 h-screen flex flex-col bg-gray-900 border-r border-gray-800/50 transition-all duration-200 z-40 ${collapsed ? 'w-16' : 'w-60'}`}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-gray-800/50">
        <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
          <span className="text-teal-400 text-sm font-bold">M</span>
        </div>
        {!collapsed && <span className="text-gray-100 font-semibold text-sm">MagicWand</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-1">
        <button
          onClick={() => navigate('/dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive('/dashboard') || isActive('/computers')
              ? 'bg-gray-800/50 text-gray-100'
              : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/30'
          }`}
        >
          {(isActive('/dashboard') || isActive('/computers')) && (
            <div className="absolute left-0 w-0.5 h-5 bg-teal-500 rounded-r" />
          )}
          <Monitor className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </button>
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-gray-800/50 space-y-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 transition-colors"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 hover:bg-gray-800/30 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">{user?.email || 'Logout'}</span>}
        </button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create `web/src/components/AppLayout.tsx`**

```tsx
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
```

Note: The `ml-60` matches the sidebar width of `w-60` (240px). When sidebar collapses to `w-16`, the main content margin should adjust. For simplicity, keep `ml-60` fixed. The sidebar overlaps slightly when collapsed — this is acceptable for v1.

- [ ] **Step 3: Modify `web/src/App.tsx`**

Wrap protected routes in AppLayout:

```tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ComputerView } from './pages/ComputerView';
import { AppLayout } from './components/AppLayout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  if (isLoading) return <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-500">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/computers/:id" element={<ProtectedRoute><ComputerView /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify in browser**

Run: Open browser, login, confirm sidebar appears on left with Dashboard nav item, main content renders to the right.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Sidebar.tsx web/src/components/AppLayout.tsx web/src/App.tsx
git commit -m "feat: add sidebar navigation and app layout"
```

---

### Task 2: Restyle Login Page

**Files:**
- Modify: `web/src/pages/Login.tsx`

- [ ] **Step 1: Rewrite Login.tsx styling**

Replace the entire return JSX with:

```tsx
return (
  <div className="flex items-center justify-center min-h-screen bg-gray-950">
    <div className="w-full max-w-sm">
      <div className="bg-gray-900 border border-gray-800/50 rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 mb-4">
            <span className="text-teal-400 text-lg font-bold">M</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-100">MagicWand</h1>
          <p className="text-gray-500 mt-1 text-sm">Remote Management Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-800/50 border-gray-800 text-gray-100 placeholder:text-gray-600"
              required
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-gray-800/50 border-gray-800 text-gray-100 placeholder:text-gray-600"
              required
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  </div>
);
```

Key changes: teal button, card container with subtle border, removed credentials hint, teal logo icon.

- [ ] **Step 2: Verify in browser**

Open `/login`, confirm teal accent, clean card, no credentials showing.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Login.tsx
git commit -m "feat: restyle login page with teal accent and clean card"
```

---

### Task 3: Restyle Dashboard Page

**Files:**
- Modify: `web/src/pages/Dashboard.tsx`

- [ ] **Step 1: Rewrite Dashboard layout**

Remove the old header (logo, logout button — those are now in sidebar). Replace with clean page header and grid:

```tsx
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useComputerStore } from '../stores/computerStore';
import { ComputerCard } from '../components/ComputerCard';
import { AddComputerModal } from '../components/AddComputerModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useNavigate } from 'react-router-dom';
import { api, getWsBase } from '../lib/api';

export function Dashboard() {
  const { computers, loading, fetchComputers, updateStatus, updateHeartbeat } = useComputerStore();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [wsToken, setWsToken] = useState<string | null>(null);

  useEffect(() => {
    fetchComputers();
    api.get<{ token: string }>('/api/auth/ws-token').then((d) => setWsToken(d.token));
  }, [fetchComputers]);

  const wsUrl = wsToken
    ? `${getWsBase()}/ws/dashboard?token=${wsToken}`
    : '';

  useWebSocket({
    url: wsUrl,
    enabled: !!wsToken,
    onMessage: (data) => {
      if (data.type === 'status') updateStatus(data.computerId, data.online);
      if (data.type === 'heartbeat') updateHeartbeat(data.computerId, data);
    },
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">Computers</h1>
          <p className="text-sm text-gray-500 mt-1">{computers.length} device{computers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Computer
        </Button>
      </div>

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : computers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-900 border border-gray-800/50 flex items-center justify-center mb-4">
            <Plus className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-gray-500 text-sm mb-4">No computers registered yet</p>
          <Button
            onClick={() => setShowAddModal(true)}
            className="bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium"
          >
            Add Your First Computer
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {computers.map((c) => (
            <ComputerCard key={c.id} computer={c} onClick={() => navigate(`/computers/${c.id}`)} />
          ))}
        </div>
      )}

      <AddComputerModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
```

Key changes: removed header bar and logout (in sidebar now), teal "Add Computer" button with subtle styling, cleaner empty state, computers passed `onClick` to navigate.

- [ ] **Step 2: Verify in browser**

Open dashboard, confirm clean layout, no duplicate header, teal add button.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Dashboard.tsx
git commit -m "feat: restyle dashboard with clean header and teal accent"
```

---

### Task 4: Restyle ComputerCard

**Files:**
- Modify: `web/src/components/ComputerCard.tsx`

- [ ] **Step 1: Rewrite ComputerCard**

Simplify to click-to-open card, no action buttons. Clean layout with subtle resource bars:

```tsx
import type { Computer } from '../stores/computerStore';

interface Props {
  computer: Computer;
  onClick: () => void;
}

function ResourceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-0.5 bg-gray-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  );
}

export function ComputerCard({ computer, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-gray-900 border border-gray-800/50 rounded-xl p-5 transition-colors hover:border-gray-700/50 ${
        !computer.isOnline ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-100 truncate">{computer.hostname || computer.name}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
          computer.isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-gray-600'
        }`} />
      </div>

      <p className="text-xs text-gray-500 font-mono truncate mb-4">
        {computer.os}{computer.ipAddress ? ` · ${computer.ipAddress}` : ''}
      </p>

      {computer.isOnline && (
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>CPU</span>
              <span>{computer.cpuPercent ?? 0}%</span>
            </div>
            <ResourceBar value={computer.cpuPercent ?? 0} color="bg-teal-500" />
          </div>
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>RAM</span>
              <span>{computer.ramPercent ?? 0}%</span>
            </div>
            <ResourceBar value={computer.ramPercent ?? 0} color="bg-gray-400" />
          </div>
        </div>
      )}
    </button>
  );
}
```

Key changes: entire card is a button, no AI Chat/Details/Delete buttons, status dot instead of text, teal CPU bar, thinner bars (0.5 = 2px), hostname as primary text.

- [ ] **Step 2: Verify in browser**

Confirm cards are clickable, clean, minimal. No action buttons.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ComputerCard.tsx
git commit -m "feat: simplify computer card to click-to-open with teal bars"
```

---

### Task 5: Restyle ComputerView Page

**Files:**
- Modify: `web/src/pages/ComputerView.tsx`

- [ ] **Step 1: Rewrite ComputerView with breadcrumb and underline tabs**

```tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../lib/api';
import type { Computer } from '../stores/computerStore';
import { SystemInfoPanel } from '../components/SystemInfoPanel';
import { AIChat } from '../components/AIChat';

export function ComputerView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [computer, setComputer] = useState<Computer | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

  useEffect(() => {
    if (id) {
      api.get<Computer>(`/api/computers/${id}`).then(setComputer).catch(() => navigate('/dashboard'));
    }
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!computer || !confirm('Delete this computer?')) return;
    await api.del(`/api/computers/${computer.id}`);
    navigate('/dashboard');
  };

  if (!computer) return <div className="p-8 text-gray-500">Loading...</div>;

  return (
    <div className="p-8">
      {/* Breadcrumb header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => navigate('/dashboard')} className="text-gray-500 hover:text-gray-300 transition-colors">
            Computers
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-100 font-medium">{computer.name}</span>
          <span className={`w-2 h-2 rounded-full ml-1 ${
            computer.isOnline ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.4)]' : 'bg-gray-600'
          }`} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-gray-600 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Underline tabs */}
      <div className="flex gap-6 border-b border-gray-800/50 mb-6">
        {(['overview', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-gray-100 border-teal-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab === 'overview' ? 'Overview' : 'AI Assistant'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' ? (
        computer.isOnline ? (
          <SystemInfoPanel computerId={computer.id} />
        ) : (
          <div className="text-gray-600 py-12 text-center text-sm">
            Computer is offline. System info unavailable.
          </div>
        )
      ) : (
        <AIChat computerId={computer.id} isOnline={computer.isOnline} />
      )}
    </div>
  );
}
```

Key changes: breadcrumb instead of back button, underline tabs instead of boxed, delete button as subtle ghost icon, removed StatusIndicator component usage (inline dot now).

- [ ] **Step 2: Verify in browser**

Click a computer card, confirm breadcrumb navigation, underline tabs, teal active indicator.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/ComputerView.tsx
git commit -m "feat: restyle computer view with breadcrumbs and underline tabs"
```

---

### Task 6: Restyle SystemInfoPanel

**Files:**
- Modify: `web/src/components/SystemInfoPanel.tsx`

- [ ] **Step 1: Restyle the panel**

Update card styling to match new design: subtler borders, teal resource bars, more whitespace, uppercase section headers. Keep the data fetching logic and structure, just update the JSX/classes:

- Cards: `bg-gray-900 border border-gray-800/50 rounded-xl p-5`
- Section headers: `text-xs font-medium text-gray-500 uppercase tracking-wider`
- Icons: `text-gray-600 w-4 h-4`
- Resource bars: `h-0.5 bg-gray-800` track, `bg-teal-500` fill for CPU, `bg-gray-400` for RAM
- Disk bars: `bg-emerald-500` normal, `bg-red-500` if >90%
- Data text: `text-sm text-gray-300`
- Label text: `text-xs text-gray-500`
- Grid: `grid grid-cols-1 md:grid-cols-2 gap-4`

- [ ] **Step 2: Verify in browser**

Open a computer's overview tab, confirm cleaner cards with teal bars.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SystemInfoPanel.tsx
git commit -m "feat: restyle system info panel with teal accents and cleaner layout"
```

---

### Task 7: Restyle AI Chat Components

**Files:**
- Modify: `web/src/components/AIChat.tsx`
- Modify: `web/src/components/ChatMessage.tsx`
- Modify: `web/src/components/ToolCallDisplay.tsx`

- [ ] **Step 1: Restyle ChatMessage.tsx**

- User messages: `bg-teal-500/10 text-gray-100 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[70%]`
- Assistant messages: `bg-gray-900 border border-gray-800/50 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%]`
- Keep markdown rendering with `prose prose-invert prose-sm`

- [ ] **Step 2: Restyle ToolCallDisplay.tsx**

- Container: `bg-gray-950 border border-gray-800/50 rounded-lg my-2`
- Function name: `font-mono text-xs text-teal-400` (was blue)
- Keep expand/collapse, loading/success/error icons

- [ ] **Step 3: Restyle AIChat.tsx**

- Quick actions: `border border-gray-800 rounded-full text-xs text-gray-500 hover:border-teal-500/30 hover:text-teal-400`
- Input area: `border-t border-gray-800/50 p-4`
- Input: `bg-gray-900 border-gray-800 rounded-xl`
- Send button: `bg-teal-500 hover:bg-teal-400 text-gray-950`
- Cancel button: keep red/destructive
- Thinking state: `text-gray-600`
- Streaming bubble: `bg-gray-900 border border-gray-800/50 rounded-2xl rounded-bl-sm`

- [ ] **Step 4: Verify in browser**

Open AI chat, send a message (or just check the UI renders). Confirm teal user bubbles, clean assistant bubbles, teal quick action hover.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/AIChat.tsx web/src/components/ChatMessage.tsx web/src/components/ToolCallDisplay.tsx
git commit -m "feat: restyle AI chat with teal user messages and cleaner tool displays"
```

---

### Task 8: Restyle AddComputerModal

**Files:**
- Modify: `web/src/components/AddComputerModal.tsx`

- [ ] **Step 1: Update modal styling**

- Dialog: `bg-gray-900 border border-gray-800/50 text-gray-100 rounded-xl max-w-md`
- Title: `text-gray-100`
- Input: `bg-gray-800/50 border-gray-800 text-gray-100 placeholder:text-gray-600`
- Generate button: `bg-teal-500 hover:bg-teal-400 text-gray-950 font-medium`
- Download button: Same teal styling
- PowerShell code: `bg-gray-950 border border-gray-800/50 rounded-lg text-teal-400` (was green)
- Waiting text: `text-gray-500`
- Token expiry text: `text-gray-600`

- [ ] **Step 2: Verify in browser**

Click "Add Computer", confirm teal-themed modal.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/AddComputerModal.tsx
git commit -m "feat: restyle add computer modal with teal theme"
```

---

### Task 9: Build, Test, Final Commit

**Files:**
- Modify: `web/src/components/StatusIndicator.tsx` (optional cleanup — may no longer be imported anywhere)

- [ ] **Step 1: Check for unused imports/components**

After removing StatusIndicator usage from ComputerView, check if it's still imported anywhere:

```bash
cd /mnt/d/Projects/MagicWand && grep -r "StatusIndicator" web/src/
```

If unused, leave it (don't delete — YAGNI applies to deletions too, it doesn't hurt).

- [ ] **Step 2: Rebuild frontend**

```bash
cd /mnt/d/Projects/MagicWand/web && npm run build
```

Expect: Build succeeds with no errors.

- [ ] **Step 3: Restart server and verify production build**

```bash
kill $(lsof -t -i:3001) 2>/dev/null
cd /mnt/d/Projects/MagicWand/server && nohup npx tsx src/index.ts > /tmp/magicwand-server.log 2>&1 &
```

Open `http://localhost:3001` — confirm the restyled app loads correctly through the Express static serving.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: rebuild frontend with enterprise UI redesign"
git push origin master
```
