import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Search, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Calendar, Tag, Wallet,
  ChevronUp, ChevronDown, CalendarDays, ListTree, X, Link2,
  ShoppingBag, Utensils, Car, Plane, Home, Briefcase, Gamepad2, Heart, Music, BookOpen,
  Gift, Coffee, Dumbbell, ShoppingCart, Zap, CreditCard, PiggyBank, TrendingUp, Bus, Bike,
  Globe, Baby, Dog, Smartphone, Monitor, Shirt, Scissors, Star,
  Cookie, IceCream2, Pizza, Sandwich, Soup, MapPin, Map as MapIcon, Compass, Mountain,
  Truck, Fuel, Wrench, Banknote, ShoppingBasket, Package, Trees, Umbrella, Flame, Tent,
  Repeat, Coins, Receipt, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, TransactionType } from '../../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { TransactionAdd } from './add';
import { TransactionEdit } from './edit';
import { useMonthRange } from '../../contexts/MonthRangeContext';
import { useVisibility } from '../../contexts/VisibilityContext';

export function Transactions() {
  const { user } = useAuth();
  const { monthOptions } = useMonthRange(); // ← global cached month list
  const { maskAmount } = useVisibility();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterMonthYear, setFilterMonthYear] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterIncomeId, setFilterIncomeId] = useState<string>('all');
  const [monthIncomes, setMonthIncomes] = useState<{ id: string, description: string, amount: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });

  // Edit/Split State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Infinite Scroll State
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (user) {
      fetchTransactions(false);
      fetchStats();
    }
  }, [user, filterType, filterMonthYear, filterIncomeId, debouncedSearchTerm]);

  useEffect(() => {
    if (user && filterMonthYear) {
      const fetchIncomes = async () => {
        const [year, month] = filterMonthYear.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const { data } = await supabase
          .from('transactions')
          .select('id, description, amount')
          .eq('user_id', user.id)
          .eq('type', 'income')
          .gte('date', `${filterMonthYear}-01`)
          .lte('date', `${filterMonthYear}-${lastDay}`)
          .order('date', { ascending: false });
        if (data) setMonthIncomes(data as any[]);
      };
      fetchIncomes();
    } else {
      setMonthIncomes([]);
    }
  }, [user, filterMonthYear]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      let query = supabase.from('transactions').select('type, amount').eq('user_id', user.id)
        .neq('type', 'transfer'); // Exclude transfers from stats!

      if (filterMonthYear) {
        const [year, month] = filterMonthYear.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        query = query.gte('date', `${filterMonthYear}-01`).lte('date', `${filterMonthYear}-${lastDay}`);
      }

      if (filterIncomeId !== 'all') {
        query = query.or(`id.eq.${filterIncomeId},linked_income_id.eq.${filterIncomeId}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const income = data.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
      const expense = data.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
      setStats({ income, expense, balance: income - expense });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTransactions = async (isLoadMore = false) => {
    if (!user) return;
    if (isLoadMore) setLoadingMore(true); else setLoading(true);

    try {
      const start = isLoadMore ? transactions.length : 0;
      const end = start + (isLoadMore ? 4 : 9);

      let query = supabase
        .from('transactions')
        .select('*, transaction_details(*), wallet:wallets!wallet_id(id,name,color), to_wallet:wallets!to_wallet_id(id,name,color), transaction_category:transaction_categories!category_id(id,name,color,icon)', { count: 'exact' })
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, end);

      if (filterType !== 'all') query = query.eq('type', filterType);
      if (filterMonthYear) {
        const [year, month] = filterMonthYear.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        query = query.gte('date', `${filterMonthYear}-01`).lte('date', `${filterMonthYear}-${lastDay}`);
      }

      if (filterIncomeId !== 'all') {
        query = query.or(`id.eq.${filterIncomeId},linked_income_id.eq.${filterIncomeId}`);
      }

      if (debouncedSearchTerm) {
        // use an explicit filter string for search so it doesn't conflict with the or above
        query = query.or(`description.ilike.%${debouncedSearchTerm}%,category.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      let finalData = data as Transaction[];

      // Perform an application-level "join" for linked_incomes to avoid PGRST schema cache constraint errors
      if (finalData && finalData.length > 0) {
        const linkedIds = [...new Set(finalData.filter(t => t.linked_income_id).map(t => t.linked_income_id as string))];
        if (linkedIds.length > 0) {
          const { data: incomeDetails } = await supabase
            .from('transactions')
            .select('id, description, category, amount, date')
            .in('id', linkedIds);

          if (incomeDetails && incomeDetails.length > 0) {
            const incomeMap = new Map(incomeDetails.map(inc => [inc.id, inc]));
            finalData = finalData.map(t => ({
              ...t,
              linked_income: t.linked_income_id ? incomeMap.get(t.linked_income_id) || null : null
            }));
          }
        }
      }

      if (isLoadMore) {
        setTransactions(prev => [...prev, ...finalData]);
      } else {
        setTransactions(finalData);
      }

      if (count !== null) {
        const currentCount = isLoadMore ? transactions.length + (data?.length || 0) : (data?.length || 0);
        setHasMore(currentCount < count);
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      if (isLoadMore) setLoadingMore(false); else setLoading(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setEditingTransaction(null);
    setTransactionToDelete(id);
  };

  const handleEditInit = (txn: Transaction) => {
    setEditingTransaction(txn);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionToDelete);

      if (error) throw error;
      setTransactions(transactions.filter(t => t.id !== transactionToDelete));
      fetchStats();
      toast.success('Transaction deleted');
    } catch (error: any) {
      toast.error('Failed to delete transaction');
    } finally {
      setTransactionToDelete(null);
    }
  };

  const formatCurrency = useCallback((val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  }, []);

  const formatCompactCurrency = useCallback((val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    if (absVal >= 1000) {
      const formatted = `Rp ${Math.floor(absVal / 1000).toLocaleString('id-ID')}K`;
      return isNegative ? `-${formatted}` : formatted;
    }
    return formatCurrency(val);
  }, [formatCurrency]);

  const formatMonthYear = useCallback((dateString: string) => {
    const d = new Date(dateString + 'T00:00:00');
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
  }, []);

  const formatDateHeader = useCallback((dateString: string) => {
    const d = new Date(dateString + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const options = { day: 'numeric', month: 'long', year: 'numeric' } as const;
    const dateFmt = new Intl.DateTimeFormat('en-GB', options).format(d).toUpperCase();

    if (d.getTime() === today.getTime()) {
      return `TODAY, ${dateFmt}`;
    } else if (d.getTime() === yesterday.getTime()) {
      return `YESTERDAY, ${dateFmt}`;
    } else {
      const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d).toUpperCase();
      return `${weekday}, ${dateFmt}`;
    }
  }, []);

  // Month options come from global MonthRangeContext (fetched once at app load)

  const groupedList = useMemo(() => {
    const months: { month: string, days: { date: string, label: string, transactions: Transaction[] }[] }[] = [];

    transactions.forEach(transaction => {
      const monthStr = formatMonthYear(transaction.date);
      let monthGroup = months.find(m => m.month === monthStr);
      if (!monthGroup) {
        monthGroup = { month: monthStr, days: [] };
        months.push(monthGroup);
      }

      let dayGroup = monthGroup.days.find(d => d.date === transaction.date);
      if (!dayGroup) {
        dayGroup = { date: transaction.date, label: formatDateHeader(transaction.date), transactions: [] };
        monthGroup.days.push(dayGroup);
      }

      dayGroup.transactions.push(transaction);
    });

    return months;
  }, [transactions, formatMonthYear, formatDateHeader]);

  const observer = useRef<IntersectionObserver | null>(null);
  const observerTarget = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore || !hasMore) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchTransactions(true);
      }
    }, { rootMargin: '400px' });

    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore, transactions.length, filterType, filterMonthYear, debouncedSearchTerm]);

  useEffect(() => {
    return () => { if (observer.current) observer.current.disconnect(); };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20 relative"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Activity</h1>
          <p className="text-muted-foreground">Manage your income and expenses.</p>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          {isAdding ? <ChevronUp size={20} /> : <Plus size={20} />}
          {isAdding ? 'Close Form' : 'Add Transaction'}
        </button>
      </header>

      <TransactionAdd
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        onSuccess={() => { setIsAdding(false); fetchTransactions(); fetchStats(); }}
        formatCurrency={formatCurrency}
      />

      <TransactionEdit
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSuccess={() => { setEditingTransaction(null); fetchTransactions(); fetchStats(); }}
        onDeleteRequest={handleDeleteRequest}
        formatCurrency={formatCurrency}
      />

      {/* Filters & Search */}
      <div className="flex flex-col xl:flex-row gap-4">
        {/* Left Side: Search & Date Filter */}
        <div className="grid grid-cols-2 sm:flex sm:flex-1 gap-2">
          <div className="relative group sm:flex-1 min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search activity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-card border border-border rounded-2xl py-3 pl-11 pr-4 sm:pr-10 font-bold outline-none focus:ring-2 ring-primary/20 transition-all h-full min-w-0"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hidden sm:block">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative sm:flex-1 md:flex-none min-w-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <CalendarDays size={18} />
            </div>
            <select
              value={filterMonthYear}
              onChange={(e) => {
                setFilterMonthYear(e.target.value);
                setFilterIncomeId('all'); // Reset income filter on month change
              }}
              className="w-full bg-card border border-border rounded-2xl py-3 pl-10 pr-4 font-bold outline-none focus:ring-2 ring-primary/20 cursor-pointer h-full md:min-w-[170px] appearance-none"
            >
              <option value="">All Time</option>
              {monthOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: Type & Income filters */}
        <div className="grid grid-cols-2 sm:flex gap-2 shrink-0 w-full xl:w-auto">
          <div className="flex p-1 bg-card border border-border rounded-2xl md:w-fit justify-between sm:flex-1 md:flex-none">
            <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" />
            <FilterButton active={filterType === 'income'} onClick={() => setFilterType('income')} label="In" />
            <FilterButton active={filterType === 'expense'} onClick={() => setFilterType('expense')} label="Out" />
          </div>
          {monthIncomes.length > 0 && filterMonthYear && (
            <div className="relative sm:flex-1 md:flex-none sm:min-w-[180px] sm:max-w-[220px] shrink-0">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                <Link2 size={16} />
              </div>
              <select
                value={filterIncomeId}
                onChange={(e) => setFilterIncomeId(e.target.value)}
                className="w-full h-full bg-primary/5 border border-primary/20 text-primary rounded-2xl py-3 pl-9 pr-4 text-sm font-bold outline-none focus:ring-2 ring-primary/30 cursor-pointer appearance-none"
              >
                <option value="all">All Income</option>
                {monthIncomes.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.description || 'Pemasukan'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {filterMonthYear && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(['income', 'expense'] as const).map(t => {
            const total = t === 'income' ? stats.income : stats.expense;
            return (
              <div key={t} className={`p-2 sm:p-3 rounded-2xl border overflow-hidden ${t === 'income'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                }`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {t === 'income' ? <ArrowUpRight size={14} className="text-emerald-600 dark:text-emerald-600" /> : <ArrowDownRight size={14} className="text-rose-600 dark:text-rose-400" />}
                  <p className={`text-[10px] font-bold truncate ${t === 'income' ? 'text-emerald-600 dark:text-emerald-600' : 'text-rose-600 dark:text-rose-400'}`}>{t === 'income' ? 'Income' : 'Expense'}</p>
                </div>
                <div title={formatCurrency(total)} className={`text-xs sm:text-sm font-black truncate ${t === 'income' ? 'text-emerald-600 dark:text-emerald-600' : 'text-rose-600 dark:text-rose-400'}`}>
                  <span className="sm:hidden">{maskAmount(formatCompactCurrency(total))}</span>
                  <span className="hidden sm:inline">{maskAmount(formatCurrency(total))}</span>
                </div>
              </div>
            );
          })}
          <div className="p-2 sm:p-3 rounded-2xl border bg-card border-border overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet size={14} className="text-muted-foreground" />
              <p className="text-[10px] font-bold text-muted-foreground truncate">Balance</p>
            </div>
            <div title={formatCurrency(stats.balance)} className={`text-xs sm:text-sm font-black truncate ${stats.balance >= 0 ? 'text-emerald-600 dark:text-emerald-600' : 'text-rose-600 dark:text-rose-400'}`}>
              <span className="sm:hidden">{maskAmount(formatCompactCurrency(stats.balance))}</span>
              <span className="hidden sm:inline">{maskAmount(formatCurrency(stats.balance))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-8">
        {loading && transactions.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-3xl">No transactions found.</div>
        ) : (
          <div className="space-y-8">
            {groupedList.map((monthGroup) => (
              <div key={monthGroup.month} className="space-y-6">
                {/* Month Header */}
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-black shrink-0">{monthGroup.month}</h2>
                  <div className="flex-1 h-px bg-border"></div>
                </div>

                {/* Days */}
                <div className="space-y-6">
                  {monthGroup.days.map((dayGroup) => (
                    <div key={dayGroup.date} className="space-y-3">
                      {/* Date Header */}
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{dayGroup.label}</h3>

                      {/* Transactions Box */}
                      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
                        {dayGroup.transactions.map((transaction) => (
                          <TransactionItem
                            key={transaction.id}
                            transaction={transaction}
                            onEdit={() => handleEditInit(transaction)}
                            onDelete={() => setTransactionToDelete(transaction.id)}
                            formatCurrency={formatCurrency}
                            formatCompactCurrency={formatCompactCurrency}
                            searchTerm={debouncedSearchTerm}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div ref={observerTarget} className="h-4 w-full" />
            {loadingMore && (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            )}
            {!hasMore && transactions.length > 0 && (
              <div className="p-6 text-center text-muted-foreground text-xs font-bold">
                End of transactions
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={!!transactionToDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setTransactionToDelete(null)}
      />
    </motion.div>
  );
}

function HighlightMatch({ text, match }: { text: string, match: string }) {
  if (!match.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${match})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === match.toLowerCase()
          ? <span key={i} className="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded-sm">{part}</span>
          : part
      )}
    </>
  );
}

// Maps icon name string (stored in DB) to a Lucide icon component
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

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 sm:py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
    >
      {label}
    </button>
  );
} function TransactionItem({
  transaction, onEdit, onDelete, formatCurrency, formatCompactCurrency, searchTerm
}: {
  transaction: Transaction, onEdit: () => void, onDelete: () => void, formatCurrency: (v: number) => string, formatCompactCurrency: (v: number) => string, searchTerm: string
}) {
  const [showDetails, setShowDetails] = useState(false);
  const { maskAmount } = useVisibility();

  const isTransfer = transaction.type === 'transfer';

  const displayName = transaction.description
    || transaction.transaction_category?.name
    || transaction.category
    || '—';

  const categoryBadgeName = transaction.transaction_category?.name;
  const CategoryIcon = getCategoryIcon(transaction.transaction_category?.icon);
  const categoryColor = !isTransfer ? transaction.transaction_category?.color : undefined;

  return (
    <div onClick={onEdit} className="p-4 md:p-6 hover:bg-accent/30 transition-colors group cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${
              !categoryColor
                ? (isTransfer
                    ? 'bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                    : transaction.type === 'income'
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400')
                : ''
            }`}
            style={categoryColor ? { backgroundColor: categoryColor + '22', color: categoryColor } : undefined}
          >
            {isTransfer ? <Repeat size={24} /> : <CategoryIcon size={24} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-base line-clamp-1 break-all">
                <HighlightMatch text={displayName} match={searchTerm} />
              </h4>
              {isTransfer && (
                <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold shrink-0">
                  <Repeat size={10} /> Transfer
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Calendar size={12} /> {transaction.date.split('-').reverse().join('/')}
              </span>
              {transaction.wallet && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Wallet size={12} />
                  {isTransfer && transaction.to_wallet
                    ? `${transaction.wallet.name} → ${transaction.to_wallet.name}`
                    : transaction.wallet.name}
                </span>
              )}
              {categoryBadgeName && transaction.description && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Tag size={12} />
                  {categoryBadgeName}
                </span>
              )}
              {transaction.linked_income && (
                <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Link2 size={10} />
                  {transaction.linked_income.description || transaction.linked_income.category}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-4 shrink-0">
          <div className="text-right">
            <div title={formatCurrency(transaction.amount)} className={`font-black text-sm sm:text-lg whitespace-nowrap ${isTransfer ? 'text-blue-600 dark:text-blue-400'
              : transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
              }`}>
              {isTransfer ? '' : transaction.type === 'income' ? '+' : '-'}
              <span className="sm:hidden">{maskAmount(formatCompactCurrency(transaction.amount).replace('Rp ', ''))}</span>
              <span className="hidden sm:inline">{maskAmount(formatCurrency(transaction.amount).replace('Rp ', ''))}</span>
            </div>
          </div>
        </div>
      </div>

      {transaction.transaction_details && transaction.transaction_details.length > 0 && (
        <div className="mt-3 ml-12 sm:ml-16">
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetails(!showDetails); }}
            className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 bg-accent/50 hover:bg-accent px-2 py-1 rounded-md transition-colors"
          >
            <ListTree size={12} /> {transaction.transaction_details.length} Details {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 border-l-2 border-border pl-3 mt-2">
                  {transaction.transaction_details.map(det => (
                    <div key={det.id} className="text-[11px] font-medium text-muted-foreground flex items-center justify-between gap-2 break-all">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="size-1 bg-border rounded-full shrink-0"></span>
                        <HighlightMatch text={det.name || det.text || '—'} match={searchTerm} />
                      </div>
                      {det.amount != null && (
                        <span className="font-bold text-foreground whitespace-nowrap">{formatCurrency(Number(det.amount) || 0)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
