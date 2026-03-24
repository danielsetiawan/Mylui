import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LayoutDashboard, ReceiptText, CalendarDays, Wallet, LogOut, ChevronDown, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export function Layout() {
  const { profile, user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = savedTheme === 'dark' || (!savedTheme && systemDark);
    
    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Logged out successfully');
  };

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex flex-col h-screen bg-background text-foreground md:flex-row transition-colors">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-6 relative">
        <div className="flex items-center gap-2 mb-10 px-2 justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Wallet size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">MyLui</span>
          </div>
          <button 
            onClick={toggleTheme} 
            className="p-1.5 text-muted-foreground hover:bg-accent rounded-xl transition-colors"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/transactions" icon={<ReceiptText size={20} />} label="Transactions" />
          <NavItem to="/planning" icon={<CalendarDays size={20} />} label="Planning" />
        </nav>

        {/* User Info + Logout */}
        <div className="pt-6 border-t border-border relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-accent transition-colors"
          >
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-black shrink-0">
              {initials}
            </div>
            <div className="flex flex-col flex-1 text-left min-w-0">
              <span className="text-sm font-semibold truncate">{displayName}</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
            <ChevronDown size={16} className={`text-muted-foreground transition-transform shrink-0 ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-2xl shadow-lg overflow-hidden"
              >
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 transition-colors text-sm font-bold"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1 rounded-md">
            <Wallet size={18} />
          </div>
          <span className="font-bold">MyLui</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="size-8 rounded-full bg-accent flex items-center justify-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={handleSignOut}
            className="size-8 rounded-full bg-accent flex items-center justify-center text-xs text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-card/90 backdrop-blur-md border border-border flex justify-around py-3 px-2 z-20 rounded-2xl shadow-xl">
        <MobileNavItem to="/" icon={<LayoutDashboard size={20} />} label="Home" />
        <MobileNavItem to="/transactions" icon={<ReceiptText size={20} />} label="Transactions" />
        <MobileNavItem to="/planning" icon={<CalendarDays size={20} />} label="Planning" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
          isActive
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }`
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

function MobileNavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors ${
          isActive ? 'text-primary' : 'text-muted-foreground'
        }`
      }
    >
      <div className="p-1 rounded-full">{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
}
