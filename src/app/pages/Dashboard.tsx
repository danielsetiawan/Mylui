import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  Plus,
  ReceiptText,
  Target
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction, BudgetPlan } from '../lib/types';

export function Dashboard() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      try {
        const [txResult, planResult] = await Promise.all([
          supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false }),
          supabase
            .from('budget_plans')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(3),
        ]);
        if (txResult.data) setTransactions(txResult.data as Transaction[]);
        if (planResult.data) setPlans(planResult.data as BudgetPlan[]);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  // Build chart data: last 7 days
  const chartData = useMemo(() => {
    const days: { name: string; income: number; expense: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      const income = transactions
        .filter(t => t.type === 'income' && t.date === dayStr)
        .reduce((acc, t) => acc + t.amount, 0);
      const expense = transactions
        .filter(t => t.type === 'expense' && t.date === dayStr)
        .reduce((acc, t) => acc + t.amount, 0);
      days.push({ name: dayName, income, expense });
    }
    return days;
  }, [transactions]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  // Trend bulan ini vs bulan lalu
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

  const thisMonthIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(thisMonth)).reduce((a, t) => a + t.amount, 0);
  const lastMonthIncome = transactions.filter(t => t.type === 'income' && t.date.startsWith(lastMonth)).reduce((a, t) => a + t.amount, 0);
  const incomeTrend = lastMonthIncome === 0 ? null : ((thisMonthIncome - lastMonthIncome) / lastMonthIncome * 100).toFixed(0);

  const thisMonthExpense = transactions.filter(t => t.type === 'expense' && t.date.startsWith(thisMonth)).reduce((a, t) => a + t.amount, 0);
  const lastMonthExpense = transactions.filter(t => t.type === 'expense' && t.date.startsWith(lastMonth)).reduce((a, t) => a + t.amount, 0);
  const expenseTrend = lastMonthExpense === 0 ? null : ((thisMonthExpense - lastMonthExpense) / lastMonthExpense * 100).toFixed(0);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 15) return 'Good Afternoon';
    if (h < 18) return 'Good Evening';
    return 'Good Night';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-8"
    >
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">{greeting()}, <span className="text-foreground font-bold">{profile?.full_name?.split(' ')[0] || 'User'}</span> 👋</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your financial summary today.</p>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard 
          title="Total Balance" 
          amount={balance} 
          icon={<Wallet className="text-primary-foreground" size={20} />}
          trend={null}
          positive={balance >= 0}
          primary
          formatCurrency={formatCurrency}
        />
        <SummaryCard 
          title="Income" 
          amount={totalIncome} 
          icon={<TrendingUp className="text-emerald-500" size={20} />}
          trend={incomeTrend !== null ? `${Number(incomeTrend) >= 0 ? '+' : ''}${incomeTrend}% from last month` : 'First month'}
          positive={Number(incomeTrend) >= 0}
          formatCurrency={formatCurrency}
        />
        <SummaryCard 
          title="Expense" 
          amount={totalExpense} 
          icon={<TrendingDown className="text-rose-500" size={20} />}
          trend={expenseTrend !== null ? `${Number(expenseTrend) >= 0 ? '+' : ''}${expenseTrend}% from last month` : 'First month'}
          positive={Number(expenseTrend) <= 0}
          formatCurrency={formatCurrency}
        />
      </div>

      {/* Chart and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg">Cash Flow Last 7 Days</h3>
            </div>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#030213" stopOpacity={0.08}/>
                      <stop offset="95%" stopColor="#030213" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.08}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                  <YAxis hide />
                  <Tooltip 
                    formatter={(val: number) => [formatCurrency(val)]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="income" 
                    name="Income"
                    stroke="#030213" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorIncome)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense"
                    name="Expense"
                    stroke="#e11d48" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fillOpacity={1}
                    fill="url(#colorExpense)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-4 justify-center">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <div className="w-4 h-0.5 bg-foreground rounded" />
                Income
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <div className="w-4 h-0.5 bg-rose-500 rounded border-dashed" style={{ borderTop: '2px dashed #e11d48', background: 'none' }} />
                Expense
              </div>
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
                    <p className="font-black text-sm text-primary">{formatCurrency(plan.total_budget)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Recent Transactions</h3>
            </div>
            
            <div className="flex-1 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                  <ReceiptText size={32} className="opacity-20" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                transactions.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">{t.category}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-extrabold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount).replace('Rp\u00a0', 'Rp ')}
                    </span>
                  </div>
                ))
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

function SummaryCard({ title, amount, icon, trend, positive, primary, formatCurrency }: any) {
  return (
    <div className={`p-6 rounded-3xl border border-border shadow-sm flex flex-col gap-4 ${primary ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-2xl ${primary ? 'bg-white/10' : 'bg-accent'}`}>
          {icon}
        </div>
        {trend && (
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className={`text-xs font-semibold ${primary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{title}</p>
        <h4 className="text-2xl font-black mt-1">{formatCurrency(amount)}</h4>
      </div>
    </div>
  );
}
