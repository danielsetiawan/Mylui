import React from 'react';
import { NavLink, Outlet } from 'react-router';
import { LayoutDashboard, ReceiptText, CalendarDays, Wallet } from 'lucide-react';
import { motion } from 'motion/react';

export function Layout() {
  return (
    <div className="flex flex-col h-screen bg-background text-foreground md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border p-6">
        <div className="flex items-center gap-2 mb-10 px-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Wallet size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">MyLui</span>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/transactions" icon={<ReceiptText size={20} />} label="Transaksi" />
          <NavItem to="/planning" icon={<CalendarDays size={20} />} label="Perencanaan" />
        </nav>

        <div className="pt-6 border-t border-border">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="size-8 rounded-full bg-accent flex items-center justify-center text-xs font-medium">
              ML
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">User MyLui</span>
              <span className="text-xs text-muted-foreground">Premium Account</span>
            </div>
          </div>
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
        <div className="size-8 rounded-full bg-accent flex items-center justify-center text-xs">
          ML
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around py-2 px-4 z-20">
        <MobileNavItem to="/" icon={<LayoutDashboard size={20} />} label="Beranda" />
        <MobileNavItem to="/transactions" icon={<ReceiptText size={20} />} label="Transaksi" />
        <MobileNavItem to="/planning" icon={<CalendarDays size={20} />} label="Rencana" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
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
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors ${
          isActive
            ? 'text-primary'
            : 'text-muted-foreground'
        }`
      }
    >
      <div className={`p-1 rounded-full ${to === '/' ? '' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium">{label}</span>
    </NavLink>
  );
}
