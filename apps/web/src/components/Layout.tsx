import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Database,
  FileText,
  FolderTree,
  LayoutDashboard,
  Menu,
  Moon,
  Server,
  Settings,
  Sun,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui';

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/tools', label: 'MCP Tools', icon: Wrench },
  { to: '/files', label: 'File Explorer', icon: FolderTree },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/database', label: 'Database', icon: Database },
  { to: '/logs', label: 'Execution History', icon: Activity },
  { to: '/status', label: 'Server Status', icon: Server },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/docs', label: 'Documentation', icon: BookOpen },
];

export function Layout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('local-mcp-theme', theme);
  }, [theme]);

  useEffect(() => {
    const saved = localStorage.getItem('local-mcp-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-bg-elevated/95 backdrop-blur transition-all md:static',
          collapsed ? 'w-[72px]' : 'w-64',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Local MCP Toolkit</p>
              <p className="truncate text-[11px] text-fg-muted">loopback · no cloud APIs</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-fg-muted hover:bg-bg-muted hover:text-fg',
                  collapsed && 'justify-center px-2',
                )
              }
              title={item.label}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {!collapsed && <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>}
          </Button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/80 px-4 backdrop-blur md:hidden">
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-4 w-4" />
          </Button>
          <span className="font-semibold">Local MCP Toolkit</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
