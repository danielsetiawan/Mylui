import React, { useState, useEffect } from 'react';
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

export function Planning() {
  const { user } = useAuth();
  const { monthOptions } = useMonthRange();
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BudgetPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<BudgetPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Pagination states
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const ITEMS_PER_PAGE = 10;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterMonthYear, setFilterMonthYear] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (user) {
      setPage(0);
      setPlans([]);
      fetchPlans(0);
    }
  }, [user, debouncedSearchTerm, filterMonthYear]);

  const fetchPlans = async (pageNum: number) => {
    if (!user) return;
    try {
      if (pageNum === 0) setLoading(true);
      else setIsFetchingMore(true);

      let query = supabase
        .from('budget_plans')
        .select('*, budget_plan_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(pageNum * ITEMS_PER_PAGE, (pageNum + 1) * ITEMS_PER_PAGE - 1);

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

      const newPlans = data as BudgetPlan[];
      if (pageNum === 0) {
        setPlans(newPlans);
      } else {
        setPlans(prev => [...prev, ...newPlans]);
      }
      
      setHasMore(newPlans.length === ITEMS_PER_PAGE);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPlans(nextPage);
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      const { error } = await supabase
        .from('budget_plans')
        .delete()
        .eq('id', planToDelete.id);
      if (error) throw error;
      setPlans(plans.filter(p => p.id !== planToDelete.id));
      if (selectedPlan?.id === planToDelete.id) setSelectedPlan(null);
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-4 sm:gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
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
            const totalEstimate = items.reduce((sum, item) => sum + item.estimate, 0);
            const sisaValue = plan.total_budget - totalEstimate;
            const progress = plan.total_budget > 0 ? Math.min(totalEstimate / plan.total_budget, 1) * 100 : 0;
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
                  
                  {/* Progress Bar */}
                  <div className="w-full h-1.5 bg-primary/10 rounded-full mb-3 overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  
                  <div className="flex items-end justify-between border-t border-border pt-3 mt-auto">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-[8px] font-bold text-muted-foreground mb-0">Budget</p>
                      <div title={formatCurrency(plan.total_budget)} className="text-sm font-black text-primary truncate leading-none">
                        <span className="sm:hidden">{formatCompactCurrency(plan.total_budget)}</span>
                        <span className="hidden sm:inline">{formatCurrency(plan.total_budget)}</span>
                      </div>
                    </div>
                    {/* Used */}
                    <div className="flex-1 min-w-0 text-center px-1">
                      <p className="text-[8px] font-bold text-muted-foreground mb-0 text-center">Used</p>
                      <div title={formatCurrency(totalEstimate)} className="text-sm font-black text-foreground truncate leading-none text-center">
                        <span className="sm:hidden">{formatCompactCurrency(totalEstimate)}</span>
                        <span className="hidden sm:inline">{formatCurrency(totalEstimate)}</span>
                      </div>
                    </div>
                    {/* Remaining */}
                    <div className="flex-1 min-w-0 text-right pl-2">
                      <p className="text-[8px] font-bold text-muted-foreground mb-0 text-right">Remaining</p>
                      <div title={formatCurrency(sisaValue)} className={`text-sm font-black truncate leading-none text-right ${sisaValue < 0 ? 'text-rose-500' : 'text-primary'}`}>
                        <span className="sm:hidden">{formatCompactCurrency(sisaValue)}</span>
                        <span className="hidden sm:inline">{formatCurrency(sisaValue)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground font-medium shrink-0">
                    <span>{(plan.budget_plan_items || []).length} detail items</span>
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
        onClose={() => setIsCreating(false)}
        onSuccess={() => { setIsCreating(false); setPage(0); fetchPlans(0); }}
        formatCurrency={formatCurrency}
      />

      <PlanningDetail 
        plan={selectedPlan && !isEditing ? selectedPlan : null}
        onClose={() => setSelectedPlan(null)}
        onEditRequest={() => setIsEditing(true)}
        onDeleteRequest={(p) => { setPlanToDelete(p); setSelectedPlan(null); }}
        onStatusChange={(p, s) => {
          setPlans(plans.map(it => it.id === p.id ? { ...it, status: s } : it));
          if (selectedPlan?.id === p.id) {
            setSelectedPlan({ ...selectedPlan, status: s });
          }
        }}
        formatCurrency={formatCurrency}
        formatCompactCurrency={formatCompactCurrency}
      />

      <PlanningEdit 
        plan={isEditing ? selectedPlan : null}
        onClose={() => { setIsEditing(false); setSelectedPlan(null); }}
        onSuccess={() => { setIsEditing(false); setSelectedPlan(null); setPage(0); fetchPlans(0); }}
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
  const parts = text.split(new RegExp(`(${match})`, 'gi'));
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
