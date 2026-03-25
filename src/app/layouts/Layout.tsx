import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LayoutDashboard, ReceiptText, CalendarDays, Wallet, LogOut, ChevronDown, Moon, Sun, X } from 'lucide-react';
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
        <div className="flex items-center gap-2 mb-8 px-2 justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg transition-transform group-hover:rotate-12">
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

        {/* Desktop User Header Profile */}
        <div className="mb-8 px-2">
          <div className="bg-accent/30 rounded-2xl p-4 border border-border/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-black shadow-lg shadow-primary/20">
                {initials}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1 text-primary">Owner</span>
                <p className="text-sm font-black truncate">{displayName}</p>
              </div>
            </div>
            <div className="h-px bg-border/50 w-full mb-3" />
            <NavItem to="/settings" icon={<X size={0} className="hidden" />} label="Edit Profile" /> {/* Mocking navigation if needed */}
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/transactions" icon={<ReceiptText size={20} />} label="Transactions" />
          <NavItem to="/planning" icon={<CalendarDays size={20} />} label="Planning" />
        </nav>

        {/* Sidebar Footer Logout only */}
        <div className="pt-6 border-t border-border mt-auto">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-colors font-bold"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header with Profile Greeting */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg shadow-lg shadow-primary/20">
              <Wallet size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base leading-none tracking-tight">MyLui</span>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-normal">Hello, {profile?.full_name?.split(' ')[0] || displayName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="size-9 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={handleSignOut}
            className="size-9 rounded-full bg-accent flex items-center justify-center text-muted-foreground hover:text-rose-600 transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
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
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-card/95 backdrop-blur-xl border border-border/50 flex justify-around py-2 px-2 z-50 rounded-full shadow-2xl">
        <MobileNavItem to="/" icon={<LayoutDashboard size={22} />} label="Home" />
        <MobileNavItem to="/transactions" icon={<ReceiptText size={22} />} label="Transactions" />
        <MobileNavItem to="/planning" icon={<CalendarDays size={22} />} label="Planning" />
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
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isActive
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
        `flex flex-col items-center justify-center w-[72px] transition-all duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`p-1.5 mb-0.5 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/10 scale-110' : 'scale-100 hover:text-foreground'}`}>
            {icon}
          </div>
          <span className="text-[10px] font-extrabold tracking-wide">{label}</span>
        </>
      )}
    </NavLink>
  );
}
