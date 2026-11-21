import React, { useState, useEffect, useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, PlusCircle, Clock, CheckCircle2, Target, Search, Calendar, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BudgetPlan } from '../../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PlanningAdd } from './add';
import { PlanningEdit } from './edit';
import { PlanningDetail } from './detail';
import { useMonthRange } from '../../contexts/MonthRangeContext';
import { useVisibility } from '../../contexts/VisibilityContext';
import { queryKeys } from '../../lib/queryClient';
import { usePlanSpending } from '../../lib/planSpending';

const PAGE_SIZE = 10;

/** Sum of the item estimates = what has been planned so far (not real spending) */
export const plannedOf = (plan: BudgetPlan) =>
  (plan.budget_plan_items || []).reduce((sum, item) => sum + Number(item.estimate || 0), 0);

export function Planning() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { monthOptions } = useMonthRange();
  const { maskAmount } = useVisibility();
  const { spendingOf, isPending: spendingPending } = usePlanSpending();
  const [isCreating, setIsCreating] = useState(false);
  // Plan to copy into the create form (Duplicate)
  const [duplicateFrom, setDuplicateFrom] = useState<BudgetPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<BudgetPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<BudgetPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterMonthYear, setFilterMonthYear] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Plans list: cached per filter, PAGE_SIZE per page (asks for one extra row to know if there is more)
  const listQuery = useInfiniteQuery({
    queryKey: queryKeys.planList(user?.id, { month: filterMonthYear, search: debouncedSearchTerm }),
    enabled: !!user,
    initialPageParam: 0,
    placeholderData: keepPreviousData,
    queryFn: async ({ pageParam }) => {
      let query = supabase
        .from('budget_plans')
        .select('*, budget_plan_items(*)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE);

      if (filterMonthYear) {
        const [year, month] = filterMonthYear.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        query = query.gte('created_at', `${filterMonthYear}-01T00:00:00`).lte('created_at', `${filterMonthYear}-${lastDay}T23:59:59`);
      }
      if (debouncedSearchTerm) {
        query = query.or(`title.ilike.%${debouncedSearchTerm}%,description.ilike.%${debouncedSearchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as BudgetPlan[];
      return {
        rows: rows.slice(0, PAGE_SIZE),
        nextOffset: rows.length > PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (last) => last.nextOffset,
  });

  useEffect(() => {
    if (listQuery.isError) {
      console.error('Error fetching plans:', listQuery.error);
      toast.error('Failed to load plans');
    }
  }, [listQuery.isError]);

  const plans = useMemo(() => {
    const seen = new Set<string>();
    return (listQuery.data?.pages ?? []).flatMap(p => p.rows).filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  }, [listQuery.data]);
  const loading = listQuery.isPending;
  const hasMore = !!listQuery.hasNextPage;
  const isFetchingMore = listQuery.isFetchingNextPage;

  // Everything built from budget_plans (this page and the Dashboard preview)
  const refreshPlans = () => queryClient.invalidateQueries({ queryKey: queryKeys.plans(user?.id) });

  const handleLoadMore = () => listQuery.fetchNextPage();

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      const { error } = await supabase
        .from('budget_plans')
        .delete()
        .eq('id', planToDelete.id);
      if (error) throw error;
      if (selectedPlan?.id === planToDelete.id) setSelectedPlan(null);
      refreshPlans();
      toast.success('Plan deleted');
    } catch (error: any) {
      toast.error('Failed to delete');
    } finally {
      setPlanToDelete(null);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(val);
  };

  const formatCompactCurrency = (val: number) => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    if (absVal >= 1000) {
      const formatted = `Rp ${Math.floor(absVal / 1000).toLocaleString('id-ID')}K`;
      return isNegative ? `-${formatted}` : formatted;
    }
    return formatCurrency(val);
  };

  // Respect the "hide amounts" eye toggle on everything shown on this page
  const money = (val: number) => maskAmount(formatCurrency(val));
  const moneyCompact = (val: number) => maskAmount(formatCompactCurrency(val));


  const statusConfig = {
    planning: { label: 'Planning', className: 'bg-amber-100 text-amber-700', icon: <Clock size={10} /> },
    active: { label: 'Active', className: 'bg-blue-100 text-blue-700', icon: <Target size={10} /> },
    completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={10} /> },
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-6 pb-10"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Planning</h1>
          <p className="text-muted-foreground">Plan budgets for your specific activities.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          <PlusCircle size={20} />
          Create New Plan
        </button>
      </header>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
          <input 
            type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search plans by title or description..."
            className="w-full bg-card border border-border rounded-2xl py-3 pl-12 pr-4 font-bold outline-none focus:ring-2 ring-primary/20 transition-all placeholder:font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2 hover:border-primary/50 transition-colors shrink-0">
          <Calendar className="text-muted-foreground" size={20} />
          <select 
            value={filterMonthYear} onChange={(e) => setFilterMonthYear(e.target.value)}
            className="bg-transparent font-bold outline-none cursor-pointer appearance-none pr-4"
          >
            <option value="">All Time</option>
            {monthOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Plans Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 transition-opacity ${listQuery.isPlaceholderData ? 'opacity-60' : ''}`}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3 animate-pulse">
              <div className="h-5 w-1/2 rounded bg-accent" />
              <div className="h-3 w-2/3 rounded bg-accent" />
              <div className="h-1.5 w-full rounded-full bg-accent" />
              <div className="flex justify-between pt-3 border-t border-border">
                <div className="h-4 w-20 rounded bg-accent" /><div className="h-4 w-20 rounded bg-accent" /><div className="h-4 w-20 rounded bg-accent" />
              </div>
            </div>
          ))
        ) : plans.length === 0 ? (
          <div className="col-span-full bg-card border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <div className="p-4 bg-accent rounded-full text-muted-foreground opacity-30">
              <CalendarDays size={48} />
            </div>
            <div className="max-w-xs">
              <h3 className="font-bold text-lg">No plans found</h3>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new plan.</p>
            </div>
            {searchTerm || filterMonthYear ? (
              <button onClick={() => { setSearchTerm(''); setFilterMonthYear(''); }} className="mt-4 text-primary font-bold hover:underline">
                Clear all filters
              </button>
            ) : (
              <button onClick={() => setIsCreating(true)} className="mt-4 text-primary font-bold hover:underline">
                Start Planning
              </button>
            )}
          </div>
        ) : (
          plans.map((plan) => {
            const status = statusConfig[plan.status];
            const items = plan.budget_plan_items || [];
            const planned = plannedOf(plan);
            const { spent, count } = spendingOf(plan.id);
            const left = plan.total_budget - spent;
            const over = left < 0;
            const progress = plan.total_budget > 0 ? Math.min(spent / plan.total_budget, 1) * 100 : 0;
            return (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm hover:border-primary/50 transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div className="flex flex-col h-full">
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h3 className="font-black text-base sm:text-lg line-clamp-1 break-all">
                      <HighlightMatch text={plan.title} match={debouncedSearchTerm} />
                    </h3>
                    <div className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${status.className}`}>
                      {status.icon} <span className="hidden sm:inline">{status.label}</span>
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-2">
                    <HighlightMatch text={plan.description || 'No description'} match={debouncedSearchTerm} />
                  </p>
                  
                  {/* Progress: real spending against the budget */}
                  <div className="w-full h-1.5 bg-primary/10 rounded-full mb-3 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-500' : 'bg-primary'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  <div className="flex items-end justify-between border-t border-border pt-3 mt-auto">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[8px] font-bold text-muted-foreground mb-0">Budget</p>
                      <div title={money(plan.total_budget)} className="text-sm font-black text-primary truncate leading-none">
                        <span className="sm:hidden">{moneyCompact(plan.total_budget)}</span>
                        <span className="hidden sm:inline">{money(plan.total_budget)}</span>
                      </div>
                    </div>
                    {/* Spent = expenses linked to this plan */}
                    <div className="flex-1 min-w-0 text-center px-1">
                      <p className="text-[8px] font-bold text-muted-foreground mb-0 text-center">Spent</p>
                      <div title={money(spent)} className="text-sm font-black text-foreground truncate leading-none text-center">
                        {spendingPending ? <span className="inline-block h-3.5 w-16 rounded bg-accent animate-pulse" /> : (
                          <>
                            <span className="sm:hidden">{moneyCompact(spent)}</span>
                            <span className="hidden sm:inline">{money(spent)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Left = budget − spent */}
                    <div className="flex-1 min-w-0 text-right pl-2">
                      <p className="text-[8px] font-bold text-muted-foreground mb-0 text-right">{over ? 'Over budget' : 'Left'}</p>
                      <div title={money(left)} className={`text-sm font-black truncate leading-none text-right ${over ? 'text-rose-500' : 'text-primary'}`}>
                        {spendingPending ? <span className="inline-block h-3.5 w-16 rounded bg-accent animate-pulse" /> : (
                          <>
                            <span className="sm:hidden">{moneyCompact(left)}</span>
                            <span className="hidden sm:inline">{money(left)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground font-medium shrink-0 flex justify-between gap-2">
                    <span>{items.length} {items.length === 1 ? 'item' : 'items'} · {money(planned)} planned</span>
                    <span>{count} {count === 1 ? 'expense' : 'expenses'}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {hasMore && plans.length > 0 && (
        <div className="flex justify-center pt-8">
          <button 
            onClick={handleLoadMore}
            disabled={isFetchingMore}
            className="bg-accent/50 hover:bg-accent border border-border px-8 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
          >
            {isFetchingMore ? 'Loading more...' : 'Load More Plans'}
          </button>
        </div>
      )}

      <PlanningAdd 
        isOpen={isCreating}
        initial={duplicateFrom}
        onClose={() => { setIsCreating(false); setDuplicateFrom(null); }}
        onSuccess={() => { setIsCreating(false); setDuplicateFrom(null); refreshPlans(); }}
        formatCurrency={formatCurrency}
      />

      <PlanningDetail 
        plan={selectedPlan && !isEditing ? selectedPlan : null}
        onClose={() => setSelectedPlan(null)}
        onEditRequest={() => setIsEditing(true)}
        onDeleteRequest={(p) => { setPlanToDelete(p); setSelectedPlan(null); }}
        onDuplicateRequest={(p) => { setSelectedPlan(null); setDuplicateFrom(p); setIsCreating(true); }}
        onStatusChange={(p, s) => {
          // Update the cached lists right away, then re-sync (also refreshes the Dashboard preview)
          queryClient.setQueriesData({ queryKey: queryKeys.plans(user?.id) }, (old: any) =>
            old?.pages
              ? { ...old, pages: old.pages.map((pg: any) => ({ ...pg, rows: pg.rows.map((it: BudgetPlan) => (it.id === p.id ? { ...it, status: s } : it)) })) }
              : old
          );
          if (selectedPlan?.id === p.id) {
            setSelectedPlan({ ...selectedPlan, status: s });
          }
          refreshPlans();
        }}
        spending={selectedPlan ? spendingOf(selectedPlan.id) : undefined}
        formatCurrency={money}
        formatCompactCurrency={moneyCompact}
      />

      <PlanningEdit 
        plan={isEditing ? selectedPlan : null}
        onClose={() => { setIsEditing(false); setSelectedPlan(null); }}
        onSuccess={() => { setIsEditing(false); setSelectedPlan(null); refreshPlans(); }}
        formatCurrency={formatCurrency}
      />

      <ConfirmationDialog 
        isOpen={!!planToDelete}
        title="Delete Plan"
        message="Are you sure you want to delete this plan? This can't be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeletePlan}
        onCancel={() => setPlanToDelete(null)}
      />
    </motion.div>
  );
}

function HighlightMatch({ text, match }: { text: string, match: string }) {
  if (!match.trim()) return <>{text}</>;
  const escaped = match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === match.toLowerCase() 
          ? <span key={i} className="bg-yellow-200 dark:bg-yellow-800/50 px-0.5 rounded-sm text-foreground">{part}</span> 
          : part
      )}
    </>
  );
}
