import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreVertical,
  Plus,
  ReceiptText
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
import * as kv from '../lib/kv_client';
import { Transaction } from '../lib/types';

const data = [
  { name: 'Mon', income: 4000, expense: 2400 },
  { name: 'Tue', income: 3000, expense: 1398 },
  { name: 'Wed', income: 2000, expense: 9800 },
  { name: 'Thu', income: 2780, expense: 3908 },
  { name: 'Fri', income: 1890, expense: 4800 },
  { name: 'Sat', income: 2390, expense: 3800 },
  { name: 'Sun', income: 3490, expense: 4300 },
];

export function Dashboard() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const stored = await kv.getByPrefix('transaction:');
        setTransactions(stored as Transaction[]);
      } catch (error) {
        console.error('Error fetching transactions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, []);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpense;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-8"
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Ringkasan keuangan Anda hari ini.</p>
      </header>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard 
          title="Saldo Utama" 
          amount={balance} 
          icon={<Wallet className="text-primary" size={20} />}
          trend="+12% dari bulan lalu"
          positive={true}
          primary
        />
        <SummaryCard 
          title="Pemasukan" 
          amount={totalIncome} 
          icon={<TrendingUp className="text-emerald-500" size={20} />}
          trend="+5% dari bulan lalu"
          positive={true}
        />
        <SummaryCard 
          title="Pengeluaran" 
          amount={totalExpense} 
          icon={<TrendingDown className="text-rose-500" size={20} />}
          trend="+18% dari bulan lalu"
          positive={false}
        />
      </div>

      {/* Chart and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-lg">Statistik Aliran Dana</h3>
              <select className="bg-accent text-xs font-semibold px-3 py-1.5 rounded-full border-none outline-none">
                <option>Minggu Ini</option>
                <option>Bulan Ini</option>
              </select>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#030213" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#030213" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#030213" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorIncome)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    stroke="#d4183d" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="transparent" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Perencanaan Anggaran</h3>
              <button className="text-primary text-sm font-medium hover:underline">Lihat Semua</button>
            </div>
            <div className="space-y-4">
              <BudgetProgress name="Liburan Bali" current={2500000} target={5000000} color="bg-primary" />
              <BudgetProgress name="Dana Darurat" current={8000000} target={15000000} color="bg-emerald-500" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">Transaksi Terakhir</h3>
              <MoreVertical className="text-muted-foreground" size={20} />
            </div>
            
            <div className="flex-1 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-sm text-muted-foreground">Memuat...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                  <ReceiptText size={32} className="opacity-20" />
                  <p>Belum ada transaksi</p>
                </div>
              ) : (
                transactions.slice(0, 6).map((t) => (
                  <div key={t.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-2xl ${t.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {t.type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">{t.category}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(t.date).toLocaleDateString('id-ID')}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-extrabold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount).replace('Rp', '')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => navigate('/transactions')}
              className="mt-8 w-full bg-accent hover:bg-accent/80 text-accent-foreground py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Plus size={18} />
              Tambah Baru
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SummaryCard({ title, amount, icon, trend, positive, primary }: any) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className={`p-6 rounded-3xl border border-border shadow-sm flex flex-col gap-4 ${primary ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-2xl ${primary ? 'bg-white/10' : 'bg-accent'}`}>
          {icon}
        </div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
          {trend}
        </div>
      </div>
      <div>
        <p className={`text-xs font-semibold ${primary ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{title}</p>
        <h4 className="text-2xl font-black mt-1">{formatCurrency(amount)}</h4>
      </div>
    </div>
  );
}

function BudgetProgress({ name, current, target, color }: any) {
  const percent = Math.min(100, Math.round((current / target) * 100));
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <div>
          <p className="font-bold text-sm">{name}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(current)} / {formatCurrency(target)}</p>
        </div>
        <span className="text-xs font-black">{percent}%</span>
      </div>
      <div className="h-2 w-full bg-accent rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
