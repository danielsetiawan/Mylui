import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Search, ArrowUpRight, ArrowDownRight, Calendar, Tag, Trash2,
  ChevronUp, ChevronDown, Link2, CalendarDays, Edit2, ListTree, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, TransactionType, TransactionDetail } from '../../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { TransactionAdd } from './add';
import { TransactionEdit } from './edit';
import { useMonthRange } from '../../contexts/MonthRangeContext';

export function Transactions() {
  const { user } = useAuth();
  const { monthOptions } = useMonthRange(); // ← global cached month list
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const currentDate = new Date();
  const defaultMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonthYear, setFilterMonthYear] = useState<string>(defaultMonthYear);
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
  }, [user, filterType, filterMonthYear, debouncedSearchTerm]);

  const fetchStats = async () => {
    if (!user) return;
    try {
      let query = supabase.from('transactions').select('type, amount').eq('user_id', user.id);

      if (filterMonthYear) {
        // Correct date range for the selected month
        const [year, month] = filterMonthYear.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        query = query.gte('date', `${filterMonthYear}-01`).lte('date', `${filterMonthYear}-${lastDay}`);
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
      const end = start + (isLoadMore ? 4 : 9); // Load 10 initially, then 5

      let query = supabase
        .from('transactions')
        .select('*, transaction_details(*)', { count: 'exact' })
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
      if (debouncedSearchTerm) {
        query = query.or(`category.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;

      if (isLoadMore) {
        setTransactions(prev => [...prev, ...(data as Transaction[])]);
      } else {
        setTransactions(data as Transaction[]);
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
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
  }, []);

  // Month options come from global MonthRangeContext (fetched once at app load)

  const groupedTransactions = useMemo(() => transactions.reduce((acc, transaction) => {
    const groupKey = formatMonthYear(transaction.date);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(transaction);
    return acc;
  }, {} as Record<string, Transaction[]>), [transactions, formatMonthYear]);

  const flattenedList = useMemo(() => {
    const list: (Transaction | { isHeader: true, title: string, count: number })[] = [];
    Object.entries(groupedTransactions).forEach(([groupKey, groupTransactions]) => {
      list.push({ isHeader: true, title: groupKey, count: groupTransactions.length });
      list.push(...groupTransactions);
    });
    return list;
  }, [groupedTransactions]);

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
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search activity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-border rounded-2xl py-3 pl-11 pr-10 font-bold outline-none focus:ring-2 ring-primary/20 transition-all"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-2 shrink-0">
          <div className="relative flex-1 md:flex-none min-w-0">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
              <CalendarDays size={18} />
            </div>
            <select
              value={filterMonthYear}
              onChange={(e) => setFilterMonthYear(e.target.value)}
              className="w-full bg-card border border-border rounded-2xl py-3 pl-10 pr-4 font-bold outline-none focus:ring-2 ring-primary/20 cursor-pointer h-full md:min-w-[170px] appearance-none"
            >
              <option value="">All Time</option>
              {monthOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-1 md:flex-none p-1 bg-card border border-border rounded-2xl md:w-fit justify-between">
            <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" />
            <FilterButton active={filterType === 'income'} onClick={() => setFilterType('income')} label="In" />
            <FilterButton active={filterType === 'expense'} onClick={() => setFilterType('expense')} label="Out" />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {filterMonthYear && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(['income', 'expense'] as const).map(t => {
            const total = t === 'income' ? stats.income : stats.expense;
            return (
              <div key={t} className={`p-2 sm:p-3 rounded-2xl border ${t === 'income' ? 'bg-emerald-50 border-emerald-150' : 'bg-rose-50 border-rose-150'} overflow-hidden`}>
                <p className={`text-[10px] font-bold truncate ${t === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{t === 'income' ? 'Income' : 'Expense'}</p>
                <div title={formatCurrency(total)} className={`text-xs sm:text-sm font-black truncate ${t === 'income' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  <span className="sm:hidden">{formatCompactCurrency(total)}</span>
                  <span className="hidden sm:inline">{formatCurrency(total)}</span>
                </div>
              </div>
            );
          })}
          <div className="p-2 sm:p-3 rounded-2xl border bg-card border-border overflow-hidden">
            <p className="text-[10px] font-bold text-muted-foreground truncate">Balance</p>
            <div title={formatCurrency(stats.balance)} className={`text-xs sm:text-sm font-black truncate ${stats.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              <span className="sm:hidden">{formatCompactCurrency(stats.balance)}</span>
              <span className="hidden sm:inline">{formatCurrency(stats.balance)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
        {loading && transactions.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No transactions found.</div>
        ) : (
          <div className="divide-y divide-border">
            {flattenedList.map((item) => {
              if ('isHeader' in item) {
                return (
                  <div key={`header-${item.title}`} className="bg-accent/40 px-6 py-3 sticky top-0 backdrop-blur-md z-10 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-black text-muted-foreground">{item.title}</h3>
                    <span className="text-[10px] font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-full border border-border">{item.count} Transactions</span>
                  </div>
                );
              }
              return (
                <TransactionItem
                  key={item.id}
                  transaction={item as Transaction}
                  onEdit={() => handleEditInit(item as Transaction)}
                  onDelete={() => setTransactionToDelete((item as Transaction).id)}
                  linkedIncome={(item as Transaction).linked_income_id ? transactions.find(it => it.id === (item as Transaction).linked_income_id) : undefined}
                  formatCurrency={formatCurrency}
                  formatCompactCurrency={formatCompactCurrency}
                  searchTerm={debouncedSearchTerm}
                />
              );
            })}

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

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 sm:py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
    >
      {label}
    </button>
  );
}

function TransactionItem({
  transaction, onEdit, onDelete, linkedIncome, formatCurrency, formatCompactCurrency, searchTerm
}: {
  transaction: Transaction, onEdit: () => void, onDelete: () => void, linkedIncome?: Transaction, formatCurrency: (v: number) => string, formatCompactCurrency: (v: number) => string, searchTerm: string
}) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div onClick={onEdit} className="p-4 md:p-6 hover:bg-accent/30 transition-colors group cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl shrink-0 ${transaction.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            {transaction.type === 'income' ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-black text-base line-clamp-1 break-all">
                <HighlightMatch text={transaction.category} match={searchTerm} />
              </h4>
              {linkedIncome && (
                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 font-bold shrink-0">
                  <Link2 size={10} /> {linkedIncome.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <Calendar size={12} /> {transaction.date.split('-').reverse().join('/')}
              </span>
              {transaction.description && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 overflow-hidden" title={transaction.description}>
                  <Tag size={12} className="shrink-0" />
                  <span className="truncate max-w-[150px] sm:max-w-[300px]"><HighlightMatch text={transaction.description} match={searchTerm} /></span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 ml-4 shrink-0">
          <div className="text-right">
            <div title={formatCurrency(transaction.amount)} className={`font-black text-sm sm:text-lg whitespace-nowrap ${transaction.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {transaction.type === 'income' ? '+' : '-'}
              <span className="sm:hidden">{formatCompactCurrency(transaction.amount).replace('Rp ', '')}</span>
              <span className="hidden sm:inline">{formatCurrency(transaction.amount).replace('Rp ', '')}</span>
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
