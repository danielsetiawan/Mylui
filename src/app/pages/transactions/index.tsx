import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Plus, Search, ArrowUpRight, ArrowDownRight, ArrowRightLeft, Calendar, Tag, Wallet,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, CalendarDays, ListTree, X, Link2, Target,
  ShoppingBag, Utensils, Car, Plane, Home, Briefcase, Gamepad2, Heart, Music, BookOpen,
  Gift, Coffee, Dumbbell, ShoppingCart, Zap, CreditCard, PiggyBank, TrendingUp, Bus, Bike,
  Globe, Baby, Dog, Smartphone, Monitor, Shirt, Scissors, Star,
  Cookie, IceCream2, Pizza, Sandwich, Soup, MapPin, Map as MapIcon, Compass, Mountain,
  Truck, Fuel, Wrench, Banknote, ShoppingBasket, Package, Trees, Umbrella, Flame, Tent,
  Repeat, Coins, Receipt, Landmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { getCategoryIcon } from '../../lib/categoryIcons';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction, TransactionType } from '../../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { TransactionAdd } from './add';
import { TransactionEdit } from './edit';
import { useMonthRange } from '../../contexts/MonthRangeContext';
import { useVisibility } from '../../contexts/VisibilityContext';
import { fetchAllRows, queryKeys } from '../../lib/queryClient';

const PAGE_SIZE = 30;

const TRANSACTION_SELECT =
  '*, transaction_details(*), wallet:wallets!wallet_id(id,name,color), to_wallet:wallets!to_wallet_id(id,name,color), transaction_category:transaction_categories!category_id(id,name,color,icon), budget_plan:budget_plans!budget_plan_id(id,title)';

type MonthIncome = { id: string, description: string, category: string, amount: number, date: string };
const NO_INCOMES: MonthIncome[] = [];

function monthBounds(yyyyMM: string) {
  const [year, month] = yyyyMM.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return { start: `${yyyyMM}-01`, end: `${yyyyMM}-${lastDay}` };
}

export function Transactions() {
  const { user } = useAuth();
  const { monthOptions } = useMonthRange(); // ← global cached month list
  const { maskAmount } = useVisibility();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterMonthYear, setFilterMonthYear] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterIncomeId, setFilterIncomeId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Edit/Split State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // ── Income list of the selected month (income filter + linked-income labels) ──
  const { data: monthIncomes = NO_INCOMES } = useQuery({
    queryKey: queryKeys.monthIncomes(user?.id, filterMonthYear),
    enabled: !!user && !!filterMonthYear,
    queryFn: async () => {
      const { start, end } = monthBounds(filterMonthYear);
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, category, amount, date')
        .eq('user_id', user!.id)
        .eq('type', 'income')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MonthIncome[];
    },
  });

  // ── Summary stats: one query, summed per type on the client ──
  // Only shown (and only fetched) when a month is selected.
  const statsQuery = useQuery({
    queryKey: queryKeys.transactionStats(user?.id, { type: filterType, month: filterMonthYear, incomeId: filterIncomeId }),
    enabled: !!user && !!filterMonthYear,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { start, end } = monthBounds(filterMonthYear);
      const types = filterType === 'income' ? ['income'] : filterType === 'expense' ? ['expense'] : ['income', 'expense'];
      const rows = await fetchAllRows<{ type: string; amount: number }>(() => {
        let q = supabase
          .from('transactions')
          .select('type, amount')
          .eq('user_id', user!.id)
          .in('type', types)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true })
          .order('id', { ascending: true });
        if (filterIncomeId !== 'all') q = q.or(`id.eq.${filterIncomeId},linked_income_id.eq.${filterIncomeId}`);
        return q;
      });
      let income = 0;
      let expense = 0;
      for (const r of rows) {
        if (r.type === 'income') income += Number(r.amount ?? 0);
        else expense += Number(r.amount ?? 0);
      }
      return { income, expense, balance: income - expense };
    },
  });
  const stats = statsQuery.data ?? { income: 0, expense: 0, balance: 0 };
  const statsLoading = statsQuery.isPending;

  // ── Transaction list: cached per filter combination, PAGE_SIZE rows per page ──
  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.transactionList(user?.id, {
      type: filterType, month: filterMonthYear, incomeId: filterIncomeId, search: debouncedSearchTerm,
    }),
    enabled: !!user,
    initialPageParam: 0,
    placeholderData: keepPreviousData, // keep the old list visible while a new filter loads
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('transactions')
        .select(TRANSACTION_SELECT)
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        // Ask for one row more than a page: its presence tells us there is a next
        // page, without a separate (slow) exact count.
        .range(pageParam, pageParam + PAGE_SIZE);

      if (filterType !== 'all') query = query.eq('type', filterType);
      if (filterMonthYear) {
        const { start, end } = monthBounds(filterMonthYear);
        query = query.gte('date', start).lte('date', end);
      }

      if (filterIncomeId !== 'all') {
        query = query.or(`id.eq.${filterIncomeId},linked_income_id.eq.${filterIncomeId}`);
      }

      if (debouncedSearchTerm) {
        // use an explicit filter string for search so it doesn't conflict with the or above
        query = query.or(`description.ilike.%${debouncedSearchTerm}%,category.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as Transaction[];
      return {
        rows: rows.slice(0, PAGE_SIZE),
        nextOffset: rows.length > PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage, isPlaceholderData } = listQuery;
  const loading = listQuery.isPending;

  useEffect(() => {
    if (listQuery.isError) {
      console.error('Error fetching transactions:', listQuery.error);
      toast.error('Failed to load transactions');
    }
  }, [listQuery.isError]);

  // Flatten pages and attach linked_income from monthIncomes. Done at render time
  // so the labels appear as soon as either request finishes, whichever is first.
  const transactions = useMemo(() => {
    const incomeMap = new Map(monthIncomes.map(inc => [inc.id, inc]));
    const seen = new Set<string>();
    const result: Transaction[] = [];
    for (const page of listQuery.data?.pages ?? []) {
      for (const t of page.rows) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        result.push(t.linked_income_id
          ? { ...t, linked_income: (incomeMap.get(t.linked_income_id) || null) as any }
          : t);
      }
    }
    return result;
  }, [listQuery.data, monthIncomes]);

  // Everything derived from the transactions table (this page and the Dashboard)
  const refreshTransactions = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.transactions(user?.id) });

  const handleDeleteRequest = (id: string) => {
    setEditingTransaction(null);
    setTransactionToDelete(id);
  };

  const handleEditInit = (txn: Transaction) => {
    setEditingTransaction(txn);
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    const deletedId = transactionToDelete;
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', deletedId);

      if (error) throw error;
      // Remove the row from the cached lists right away, then re-sync with the server
      queryClient.setQueriesData({ queryKey: queryKeys.transactionLists(user?.id) }, (old: any) =>
        old?.pages
          ? { ...old, pages: old.pages.map((p: any) => ({ ...p, rows: p.rows.filter((t: Transaction) => t.id !== deletedId) })) }
          : old
      );
      refreshTransactions();
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

  // Infinite scroll: load the next page when the sentinel gets near the viewport
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage || isPlaceholderData) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) fetchNextPage();
    }, { rootMargin: '400px' });

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isPlaceholderData, fetchNextPage, transactions.length]);

  // Month switcher: monthOptions is ordered newest → oldest
  const changeMonth = (value: string) => {
    setFilterMonthYear(value);
    setFilterIncomeId('all'); // Reset income filter on month change
  };
  const monthIndex = monthOptions.findIndex(m => m.value === filterMonthYear);
  const olderMonth = monthIndex >= 0 ? monthOptions[monthIndex + 1]?.value : undefined;
  const newerMonth = monthIndex > 0 ? monthOptions[monthIndex - 1]?.value : undefined;

  const incomeFilter = monthIncomes.length > 0 && filterMonthYear ? (
    <div className="relative h-full">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <Link2 size={16} />
      </div>
      <select
        value={filterIncomeId}
        onChange={(e) => setFilterIncomeId(e.target.value)}
        aria-label="Filter by income"
        className="w-full h-full bg-primary/5 border border-primary/20 text-primary rounded-2xl py-3 pl-9 pr-4 text-sm font-bold outline-none focus:ring-2 ring-primary/30 cursor-pointer appearance-none"
      >
        <option value="all">All Income</option>
        {monthIncomes.map((inc) => (
          <option key={inc.id} value={inc.id}>
            {inc.description || 'Income'}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const openAddForm = () => {
    setIsAdding(true);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20 relative"
    >
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight">Activity</h1>
          <p className="text-muted-foreground">Manage your income and expenses.</p>
        </div>
        {/* On phones the floating button below opens the form; this one only closes it */}
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`${isAdding ? 'flex' : 'hidden md:flex'} shrink-0 bg-primary text-primary-foreground px-4 md:px-6 py-3 rounded-2xl font-bold items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20`}
        >
          {isAdding ? <ChevronUp size={20} /> : <Plus size={20} />}
          {isAdding ? 'Close Form' : 'Add Transaction'}
        </button>
      </header>

      <TransactionAdd
        isOpen={isAdding}
        onClose={() => setIsAdding(false)}
        onSuccess={() => { setIsAdding(false); refreshTransactions(); }}
        formatCurrency={formatCurrency}
      />

      <TransactionEdit
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSuccess={() => { setEditingTransaction(null); refreshTransactions(); }}
        onDeleteRequest={handleDeleteRequest}
        formatCurrency={formatCurrency}
      />

      {/* Filters — stay pinned to the top while the list scrolls */}
      <div className="sticky top-0 z-30 -mx-4 px-4 md:-mx-8 md:px-8 -mt-3 mb-3 py-3 bg-background/90 backdrop-blur-md">
        <div className="flex flex-wrap xl:flex-nowrap gap-2">
          {/* Month switcher: previous / pick / next */}
          <div className="flex items-center w-full sm:w-[250px] bg-card border border-border rounded-2xl p-1 shrink-0">
            <button
              type="button"
              onClick={() => olderMonth && changeMonth(olderMonth)}
              disabled={!olderMonth}
              aria-label="Previous month"
              className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="relative flex-1 min-w-0">
              <CalendarDays size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={filterMonthYear}
                onChange={(e) => changeMonth(e.target.value)}
                aria-label="Month"
                className="w-full bg-transparent rounded-xl py-2 pl-8 pr-2 font-bold text-center [text-align-last:center] outline-none focus:ring-2 ring-primary/20 cursor-pointer appearance-none"
              >
                <option value="">All Time</option>
                {monthOptions.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => newerMonth && changeMonth(newerMonth)}
              disabled={!newerMonth}
              aria-label="Next month"
              className="p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Search */}
          <div className="relative group flex-1 min-w-[140px] xl:min-w-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search activity..."
              aria-label="Search activity"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-full bg-card border border-border rounded-2xl py-3 pl-11 pr-10 font-bold outline-none focus:ring-2 ring-primary/20 transition-all min-w-0"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Type */}
          <div className="flex p-1 bg-card border border-border rounded-2xl shrink-0">
            <FilterButton active={filterType === 'all'} onClick={() => setFilterType('all')} label="All" />
            <FilterButton active={filterType === 'income'} onClick={() => setFilterType('income')} label="In" />
            <FilterButton active={filterType === 'expense'} onClick={() => setFilterType('expense')} label="Out" />
          </div>

          {/* Income filter — beside the type filter on wide screens */}
          {incomeFilter && <div className="hidden xl:block xl:w-[190px] shrink-0">{incomeFilter}</div>}
        </div>
      </div>

      {/* Income filter — smaller screens: its own row below, so the pinned bar stays short */}
      {incomeFilter && <div className="xl:hidden sm:w-[250px]">{incomeFilter}</div>}

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
                {statsLoading ? (
                  <div className="h-4 sm:h-5 w-20 max-w-full rounded bg-current opacity-10 animate-pulse" />
                ) : (
                  <div title={formatCurrency(total)} className={`text-xs sm:text-sm font-black truncate ${t === 'income' ? 'text-emerald-600 dark:text-emerald-600' : 'text-rose-600 dark:text-rose-400'}`}>
                    <span className="sm:hidden">{maskAmount(formatCompactCurrency(total))}</span>
                    <span className="hidden sm:inline">{maskAmount(formatCurrency(total))}</span>
                  </div>
                )}
              </div>
            );
          })}
          <div className="p-2 sm:p-3 rounded-2xl border bg-card border-border overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
              <Wallet size={14} className="text-muted-foreground" />
              <p className="text-[10px] font-bold text-muted-foreground truncate">Balance</p>
            </div>
            {statsLoading ? (
              <div className="h-4 sm:h-5 w-20 max-w-full rounded bg-current opacity-10 animate-pulse" />
            ) : (
              <div title={formatCurrency(stats.balance)} className={`text-xs sm:text-sm font-black truncate ${stats.balance >= 0 ? 'text-emerald-600 dark:text-emerald-600' : 'text-rose-600 dark:text-rose-400'}`}>
                <span className="sm:hidden">{maskAmount(formatCompactCurrency(stats.balance))}</span>
                <span className="hidden sm:inline">{maskAmount(formatCurrency(stats.balance))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-8">
        {loading || (isPlaceholderData && transactions.length === 0) ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-40 rounded bg-accent" />
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-4 md:p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-accent" />
                    <div className="h-3 w-1/3 rounded bg-accent" />
                  </div>
                  <div className="h-4 w-20 rounded bg-accent" />
                </div>
              ))}
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground bg-card border border-border rounded-3xl">No transactions found.</div>
        ) : (
          <div className={`space-y-8 transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
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

            <div ref={sentinelRef} className="h-4 w-full" />
            {isFetchingNextPage && (
              <div className="p-6 text-center">
                <div className="w-5 h-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            )}
            {!hasNextPage && !isPlaceholderData && transactions.length > 0 && (
              <div className="p-6 text-center text-muted-foreground text-xs font-bold">
                End of transactions
              </div>
            )}
          </div>
        )}
      </div>

      {/* Phones: floating button to add a transaction from anywhere in the list */}
      {!isAdding && !editingTransaction && (
        <button
          type="button"
          onClick={openAddForm}
          aria-label="Add transaction"
          className="md:hidden fixed bottom-28 right-6 z-40 size-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30 active:scale-95 transition-transform"
        >
          <Plus size={26} />
        </button>
      )}

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
              {transaction.budget_plan && (
                <span className="text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                  <Target size={10} />
                  {transaction.budget_plan.title}
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
