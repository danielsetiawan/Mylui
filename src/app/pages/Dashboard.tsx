import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  ReceiptText,
  Target,
  Tag,
  ShoppingBag, Utensils, Car, Plane, Home, Briefcase, Gamepad2, Heart, Music, BookOpen,
  Gift, Coffee, Dumbbell, ShoppingCart, Zap, CreditCard, PiggyBank, Bus, Bike,
  Globe, Baby, Dog, Smartphone, Monitor, Shirt, Scissors, Star,
  Cookie, IceCream2, Pizza, Sandwich, Soup, MapPin, Map as MapIcon, Compass, Mountain,
  Truck, Fuel, Wrench, Banknote, ShoppingBasket, Package, Trees, Umbrella, Flame, Tent,
  Repeat, Coins, Receipt, Landmark, ArrowRightLeft
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useVisibility } from '../contexts/VisibilityContext';
import { Transaction, BudgetPlan } from '../lib/types';
import { fetchAllRows, queryKeys } from '../lib/queryClient';
import { useWalletCategory } from '../contexts/WalletCategoryContext';

const ICON_MAP: Record<string, React.ElementType> = {
  Tag, ShoppingBag, Utensils, Car, Plane, Home, Briefcase, Gamepad2, Heart, Music, BookOpen,
  Gift, Coffee, Dumbbell, ShoppingCart, Zap, CreditCard, PiggyBank, TrendingUp, Bus, Bike,
  Globe, Baby, Dog, Smartphone, Monitor, Shirt, Scissors, Star, ArrowUpRight, ArrowDownRight,
  ArrowRightLeft, Wallet, Cookie, IceCream2, Pizza, Sandwich, Soup, MapPin, Compass,
  Mountain, Truck, Fuel, Wrench, Banknote, ShoppingBasket, Package, Trees, Umbrella, Flame, Tent,
  Map: MapIcon, Repeat, Coins, Receipt, Landmark
};

function getCategoryIcon(iconName?: string | null): React.ElementType {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  return Tag;
}

// Colours for categories that have none, in order. "Other" is always grey.
const FALLBACK_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];
const OTHER_COLOR = '#94a3b8';
const TOP_CATEGORIES = 5;

type DashboardRow = {
  type: 'income' | 'expense';
  amount: number;
  date: string;
  category_id: string | null;
  category: string | null; // legacy text category
};

type CategorySlice = {
  key: string;
  name: string;
  color: string;
  icon?: string | null;
  amount: number;
  share: number; // 0..1 of this month's expense
};

const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { maskAmount } = useVisibility();
  const { categories } = useWalletCategory();

  // Current month filter (same logic as Transactions page)
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const thisMonthStart = `${thisMonth}-01`;
  const thisMonthEnd = `${thisMonth}-${String(lastDay).padStart(2, '0')}`;

  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthStart = `${lastMonth}-01`;

  // One query for every income/expense row from the start of last month to the
  // end of this month. Totals, trends, the category chart and the 7-day chart are
  // all derived from it (the last 7 days always fall inside that range).
  const { data: rows = [], isPending: rowsPending } = useQuery({
    queryKey: queryKeys.dashboardRows(user?.id, thisMonth),
    enabled: !!user,
    queryFn: () =>
      fetchAllRows<DashboardRow>(() =>
        supabase
          .from('transactions')
          .select('type, amount, date, category_id, category')
          .eq('user_id', user!.id)
          .in('type', ['income', 'expense'])
          .gte('date', lastMonthStart)
          .lte('date', thisMonthEnd)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
      ),
  });

  // Latest transactions for the Recent Activity list
  const { data: recentTx = [], isPending: recentPending } = useQuery({
    queryKey: queryKeys.dashboardRecent(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_category:transaction_categories!category_id(id,name,color,icon)')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: queryKeys.dashboardPlans(user?.id),
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_plans')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as BudgetPlan[];
    },
  });

  // ── Totals: this month and last month ──
  const totals = useMemo(() => {
    const sums = { income: 0, expense: 0, lastIncome: 0, lastExpense: 0 };
    for (const r of rows) {
      const amount = Number(r.amount ?? 0);
      const isThisMonth = r.date >= thisMonthStart;
      if (r.type === 'income') {
        if (isThisMonth) sums.income += amount; else sums.lastIncome += amount;
      } else {
        if (isThisMonth) sums.expense += amount; else sums.lastExpense += amount;
      }
    }
    return sums;
  }, [rows, thisMonthStart]);

  const totalIncome = totals.income;
  const totalExpense = totals.expense;
  const balance = totalIncome - totalExpense;

  // ── This month's expense per category (top 5 + "Other") ──
  const categorySlices = useMemo<CategorySlice[]>(() => {
    const byId = new Map(categories.map(c => [c.id, c]));
    const groups = new Map<string, Omit<CategorySlice, 'share'>>();
    for (const r of rows) {
      if (r.type !== 'expense' || r.date < thisMonthStart) continue;
      const cat = r.category_id ? byId.get(r.category_id) : undefined;
      const legacy = r.category?.trim();
      const key = cat ? cat.id : legacy ? `legacy:${legacy.toLowerCase()}` : 'none';
      const group = groups.get(key) ?? {
        key,
        name: cat?.name ?? legacy ?? 'Uncategorized',
        color: cat?.color ?? '',
        icon: cat?.icon,
        amount: 0,
      };
      group.amount += Number(r.amount ?? 0);
      groups.set(key, group);
    }

    const sorted = [...groups.values()].sort((a, b) => b.amount - a.amount);
    const top = sorted.slice(0, TOP_CATEGORIES);
    const rest = sorted.slice(TOP_CATEGORIES);
    if (rest.length > 0) {
      top.push({ key: 'other', name: `Other (${rest.length})`, color: OTHER_COLOR, amount: rest.reduce((a, g) => a + g.amount, 0) });
    }
    const total = top.reduce((a, g) => a + g.amount, 0) || 1;
    let fallback = 0;
    return top.map(g => ({
      ...g,
      color: g.color || FALLBACK_COLORS[fallback++ % FALLBACK_COLORS.length],
      share: g.amount / total,
    }));
  }, [rows, categories, thisMonthStart]);

  // ── Last 7 days, one bar pair per day ──
  const chartData = useMemo(() => {
    const days: { key: string; name: string; income: number; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        key: toDateStr(d),
        name: i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' }),
        income: 0,
        expense: 0,
      });
    }
    const byDay = new Map(days.map(d => [d.key, d]));
    for (const r of rows) {
      const day = byDay.get(r.date.substring(0, 10));
      if (day) day[r.type] += Number(r.amount ?? 0);
    }
    return days;
  }, [rows]);
  const chartHasData = chartData.some(d => d.income > 0 || d.expense > 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };
  const money = (val: number) => maskAmount(formatCurrency(val));

  // Trend: this month vs last month
  const incomeTrend = totals.lastIncome === 0
    ? null
    : ((totalIncome - totals.lastIncome) / totals.lastIncome * 100).toFixed(0);
  const expenseTrend = totals.lastExpense === 0
    ? null
    : ((totalExpense - totals.lastExpense) / totals.lastExpense * 100).toFixed(0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 15) return 'Good Afternoon';
    if (h < 18) return 'Good Evening';
    return 'Good Night';
  };

  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-8"
    >
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{greeting()}, <span className="text-foreground font-bold">{profile?.full_name?.split(' ')[0] || 'User'}</span> 👋</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your summary for {monthLabel}.</p>
      </header>

      {/* Hero Stats — this month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard 
          title="Balance" 
          amount={balance} 
          icon={<Wallet className="text-primary-foreground" size={20} />}
          trend="This month"
          positive={balance >= 0}
          primary
          loading={rowsPending}
          formatCurrency={money}
        />
        <SummaryCard 
          title="Income" 
          amount={totalIncome} 
          icon={<TrendingUp className="text-emerald-500" size={20} />}
          trend={incomeTrend !== null ? `${Number(incomeTrend) >= 0 ? '+' : ''}${incomeTrend}% vs last month` : 'First month'}
          positive={Number(incomeTrend) >= 0}
          loading={rowsPending}
          formatCurrency={money}
        />
        <SummaryCard 
          title="Expense" 
          amount={totalExpense} 
          icon={<TrendingDown className="text-rose-500" size={20} />}
          trend={expenseTrend !== null ? `${Number(expenseTrend) >= 0 ? '+' : ''}${expenseTrend}% vs last month` : 'First month'}
          positive={Number(expenseTrend) <= 0}
          loading={rowsPending}
          formatCurrency={money}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
          {/* Spending by category — this month */}
          <div className="@container bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-lg">Spending by Category</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{monthLabel}</p>
              </div>
              <button onClick={() => navigate('/transactions')} className="text-primary text-sm font-medium hover:underline">Details</button>
            </div>

            {rowsPending ? (
              <div className="flex flex-col @lg:flex-row items-center gap-6 animate-pulse">
                <div className="size-44 rounded-full bg-accent shrink-0" />
                <div className="flex-1 w-full space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-2/3 rounded bg-accent" />
                      <div className="h-1.5 w-full rounded bg-accent" />
                    </div>
                  ))}
                </div>
              </div>
            ) : categorySlices.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                <ReceiptText size={32} className="opacity-20" />
                <p>No expenses recorded this month</p>
              </div>
            ) : (
              <div className="flex flex-col @lg:flex-row items-center gap-6 @lg:gap-8">
                <div className="relative size-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categorySlices}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius="72%"
                        outerRadius="100%"
                        paddingAngle={categorySlices.length > 1 ? 2 : 0}
                        stroke="none"
                        isAnimationActive={false}
                      >
                        {categorySlices.map(slice => (
                          <Cell key={slice.key} fill={slice.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Spent</span>
                    <span className="text-sm font-black leading-tight break-all">{money(totalExpense)}</span>
                  </div>
                </div>

                <ul className="flex-1 w-full space-y-3 min-w-0">
                  {categorySlices.map(slice => {
                    const Icon = slice.key === 'other' ? Tag : getCategoryIcon(slice.icon);
                    return (
                      <li key={slice.key} className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: slice.color + '22', color: slice.color }}
                            >
                              <Icon size={14} />
                            </span>
                            <span className="text-sm font-bold truncate">{slice.name}</span>
                          </div>
                          <div className="flex items-baseline gap-2 shrink-0">
                            <span className="text-sm font-extrabold">{money(slice.amount)}</span>
                            <span className="text-[11px] font-bold text-muted-foreground w-9 text-right">{Math.round(slice.share * 100)}%</span>
                          </div>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.max(slice.share * 100, 2)}%`, backgroundColor: slice.color }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Last 7 days */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-6">
              <h3 className="font-bold text-lg">Last 7 Days</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <span className="size-2.5 rounded-sm bg-primary" /> Income
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <span className="size-2.5 rounded-sm bg-rose-500" /> Expense
                </div>
              </div>
            </div>
            <div className="h-[220px] w-full">
              {rowsPending ? (
                <div className="h-full w-full rounded-2xl bg-accent animate-pulse" />
              ) : !chartHasData ? (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <ReceiptText size={32} className="opacity-20" />
                  <p>No income or expense in the last 7 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={3} barCategoryGap="28%">
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'var(--accent)', opacity: 0.6 }}
                      formatter={(val: number, name: string) => [money(val), name]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--card)',
                        color: 'var(--foreground)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                        fontSize: 12,
                      }}
                      labelStyle={{ fontWeight: 700, marginBottom: 4 }}
                    />
                    <Bar dataKey="income" name="Income" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="expense" name="Expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Budget Plans Preview */}
          {plans.length > 0 && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg">Active Budget Plans</h3>
                <button onClick={() => navigate('/planning')} className="text-primary text-sm font-medium hover:underline">View All</button>
              </div>
              <div className="space-y-4">
                {plans.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between p-3 bg-accent/40 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl">
                        <Target size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{plan.title}</p>
                        <p className="text-xs text-muted-foreground capitalize">{plan.status === 'planning' ? 'Planning' : plan.status}</p>
                      </div>
                    </div>
                    <p className="font-black text-sm text-primary">{money(plan.total_budget)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Recent Activity</h3>
            </div>
            
            <div className="flex-1 space-y-4">
              {recentPending ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 rounded-2xl bg-accent shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 rounded bg-accent" />
                      <div className="h-2 w-1/3 rounded bg-accent" />
                    </div>
                    <div className="h-3 w-16 rounded bg-accent" />
                  </div>
                ))
              ) : recentTx.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                  <ReceiptText size={32} className="opacity-20" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                recentTx.map((t) => {
                  const isTransfer = t.type === 'transfer';
                  const categoryColor = !isTransfer ? t.transaction_category?.color : undefined;
                  const CategoryIcon = getCategoryIcon(t.transaction_category?.icon);
                  const displayName = t.description || t.transaction_category?.name || t.category || '—';
                  const iconStyle = categoryColor
                    ? { backgroundColor: categoryColor + '22', color: categoryColor }
                    : undefined;
                  const iconClass = !categoryColor
                    ? (isTransfer ? 'bg-blue-500/10 text-blue-600' : t.type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600')
                    : '';
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 group">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-2xl shrink-0 ${iconClass}`} style={iconStyle}>
                          {isTransfer ? <Repeat size={18} /> : <CategoryIcon size={18} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold leading-tight truncate">{displayName}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-extrabold whitespace-nowrap ${
                        isTransfer ? 'text-blue-600' : t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isTransfer ? '' : t.type === 'income' ? '+' : '-'}{maskAmount(formatCurrency(t.amount).replace('Rp\u00a0', 'Rp '))}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <button 
              onClick={() => navigate('/transactions')}
              className="mt-6 w-full bg-accent hover:bg-accent/80 text-accent-foreground py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={18} />
              Record Transaction
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryCard({ title, amount, icon, trend, positive, primary, loading, formatCurrency }: any) {
  return (
    <div className={`p-6 rounded-3xl border border-border shadow-sm flex flex-col gap-4 ${primary ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className={`p-2 rounded-2xl shrink-0 ${primary ? 'bg-white/10' : 'bg-accent'}`}>
          {icon}
        </div>
        {trend && !loading && (
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${primary ? 'bg-primary-foreground/15 text-primary-foreground' : positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className={`text-xs font-semibold ${primary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{title}</p>
        {loading ? (
          <div className={`h-8 w-40 max-w-full rounded-lg mt-1 animate-pulse ${primary ? 'bg-primary-foreground/20' : 'bg-accent'}`} />
        ) : (
          <h4 className="text-2xl font-black mt-1">{formatCurrency(amount)}</h4>
        )}
      </div>
    </div>
  );
}
