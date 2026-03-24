import React, { useState, useEffect, useMemo } from 'react';
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

export function Planning() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BudgetPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<BudgetPlan | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const currentDate = new Date();
  const defaultMonthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const [filterMonthYear, setFilterMonthYear] = useState<string>(defaultMonthYear);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (user) fetchPlans();
  }, [user, filterMonthYear, debouncedSearchTerm]);

  const fetchPlans = async () => {
    if (!user) return;
    try {
      let query = supabase
        .from('budget_plans')
        .select('*, budget_plan_items(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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
      setPlans(data as BudgetPlan[]);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
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

  const availableMonths = useMemo(() => {
    return Array.from(new Set([
      defaultMonthYear,
      ...plans.map(p => p.created_at.substring(0, 7))
    ])).sort().reverse();
  }, [plans, defaultMonthYear]);

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
        <div className="flex items-center gap-2 bg-card border border-border rounded-2xl px-4 py-2 hover:border-primary/50 transition-colors">
          <Calendar className="text-muted-foreground" size={20} />
          <select 
            value={filterMonthYear} onChange={(e) => setFilterMonthYear(e.target.value)}
            className="bg-transparent font-bold outline-none cursor-pointer appearance-none pr-4"
          >
            <option value="">All Time</option>
            {availableMonths.map(m => {
              const [y, mm] = m.split('-');
              const date = new Date(parseInt(y), parseInt(mm) - 1);
              const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
              return <option key={m} value={m}>{label}</option>;
            })}
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
                  <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-2 bg-accent/20 py-0.5 px-2 rounded border border-border/30 break-all">
                    <HighlightMatch text={plan.description || 'No description'} match={debouncedSearchTerm} />
                  </p>
                  
                  <div className="flex items-end justify-between border-t border-border pt-2 mt-auto">
                    <div className="min-w-0 pr-2">
                      <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-0">Total</p>
                      <div title={formatCurrency(plan.total_budget)} className="text-sm font-black text-primary truncate leading-none">
                        <span className="sm:hidden">{formatCompactCurrency(plan.total_budget)}</span>
                        <span className="hidden sm:inline">{formatCurrency(plan.total_budget)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium shrink-0">
                      <span>{(plan.budget_plan_items || []).length} items</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <PlanningAdd 
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onSuccess={() => { setIsCreating(false); fetchPlans(); }}
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
        onSuccess={() => { setIsEditing(false); setSelectedPlan(null); fetchPlans(); }}
        formatCurrency={formatCurrency}
      />

      <ConfirmationDialog 
        isOpen={!!planToDelete}
        title="Delete Plan"
        message="Are you sure you want to delete this budget plan? Data cannot be recovered."
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
