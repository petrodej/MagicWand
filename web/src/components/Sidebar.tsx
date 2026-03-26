import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Monitor, Bell, ScrollText, Clock, Code2, Users, Sun, Moon, PanelLeftClose, PanelLeft, LogOut } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, role } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const isDashboardActive =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/computers');
  const isAlertsActive = location.pathname.startsWith('/alerts');
  const isAuditActive = location.pathname.startsWith('/audit');
  const isScheduledActive = location.pathname.startsWith('/scheduled');
  const isScriptsActive = location.pathname.startsWith('/scripts');
  const isSettingsActive = location.pathname.startsWith('/settings');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col bg-gray-900 border-r border-gray-800/50 transition-all duration-200 z-10 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-teal-500/10 shrink-0">
          <span className="text-teal-400 font-bold text-sm">M</span>
        </div>
        {!collapsed && (
          <span className="text-gray-100 font-semibold text-sm tracking-tight">
            MagicWand
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2">
        <button
          onClick={() => navigate('/dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
            isDashboardActive
              ? 'bg-gray-800/50 text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {isDashboardActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-teal-500 rounded-full" />
          )}
          <Monitor size={16} className="shrink-0" />
          {!collapsed && <span>Dashboard</span>}
        </button>

        <button
          onClick={() => navigate('/alerts')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
            isAlertsActive
              ? 'bg-gray-800/50 text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {isAlertsActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-teal-500 rounded-full" />
          )}
          <Bell size={16} className="shrink-0" />
          {!collapsed && <span>Alerts</span>}
        </button>

        <button
          onClick={() => navigate('/audit')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
            isAuditActive
              ? 'bg-gray-800/50 text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {isAuditActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-teal-500 rounded-full" />
          )}
          <ScrollText size={16} className="shrink-0" />
          {!collapsed && <span>Audit Log</span>}
        </button>

        <button
          onClick={() => navigate('/scheduled')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
            isScheduledActive
              ? 'bg-gray-800/50 text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {isScheduledActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-teal-500 rounded-full" />
          )}
          <Clock size={16} className="shrink-0" />
          {!collapsed && <span>Scheduled</span>}
        </button>

        <button
          onClick={() => navigate('/scripts')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
            isScriptsActive
              ? 'bg-gray-800/50 text-gray-100'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {isScriptsActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-teal-500 rounded-full" />
          )}
          <Code2 size={16} className="shrink-0" />
          {!collapsed && <span>Scripts</span>}
        </button>

        {role === 'admin' && (
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative ${
              isSettingsActive
                ? 'bg-gray-800/50 text-gray-100'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {isSettingsActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-teal-500 rounded-full" />
            )}
            <Users size={16} className="shrink-0" />
            {!collapsed && <span>Users</span>}
          </button>
        )}
      </nav>

      {/* Bottom controls */}
      <div className="px-2 py-3 border-t border-gray-800/50 flex flex-col gap-1 shrink-0">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:text-gray-300 transition-colors"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun size={16} className="shrink-0" />
          ) : (
            <Moon size={16} className="shrink-0" />
          )}
          {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
        </button>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:text-gray-300 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft size={16} className="shrink-0" />
          ) : (
            <PanelLeftClose size={16} className="shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-gray-500 hover:text-gray-300 transition-colors"
          title="Log out"
        >
          <LogOut size={16} className="shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </aside>
  );
}
