import React from 'react';
import { X, Target, Trash2, Clock, CheckCircle2, Plane, ShoppingBag, Bus, Utensils, AlertCircle, Copy, ReceiptText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { BudgetPlan } from '../../lib/types';
import { toast } from 'sonner';
import { useWalletCategory } from '../../contexts/WalletCategoryContext';
import { getCategoryIcon } from '../../lib/categoryIcons';
import { PlanSpending, usePlanTransactions } from '../../lib/planSpending';

interface Props {
  plan: BudgetPlan | null;
  /** Real spending of this plan (expenses linked to it); see lib/planSpending.ts */
  spending?: PlanSpending;
  onClose: () => void;
  onEditRequest: () => void;
  onDeleteRequest: (plan: BudgetPlan) => void;
  onDuplicateRequest: (plan: BudgetPlan) => void;
  onStatusChange: (plan: BudgetPlan, status: BudgetPlan['status']) => void;
  formatCurrency: (val: number) => string;
  formatCompactCurrency: (val: number) => string;
}

const statusConfig = {
  planning: { label: 'Planning', className: 'bg-amber-100 text-amber-700', icon: <Clock size={10} /> },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700', icon: <Target size={10} /> },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={10} /> },
};

// Items without a category: guess an icon from the name (old behaviour)
function guessIcon(name: string): React.ElementType {
  const n = name.toLowerCase();
  if (n.includes('makan')) return Utensils;
  if (n.includes('transport') || n.includes('bis')) return Bus;
  if (n.includes('tiket') || n.includes('pesawat')) return Plane;
  if (n.includes('belanja')) return ShoppingBag;
  return AlertCircle;
}

function Bar({ value, max, className = 'h-1.5' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(value / max, 1) * 100 : value > 0 ? 100 : 0;
  const over = max > 0 ? value > max : value > 0;
  return (
    <div className={`w-full bg-primary/10 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-rose-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PlanningDetail({ plan, spending, onClose, onEditRequest, onDeleteRequest, onDuplicateRequest, onStatusChange, formatCurrency }: Props) {
  const { categories } = useWalletCategory();
  const categoryById = new Map(categories.map(c => [c.id, c]));
  const { data: expenses = [], isPending: expensesPending } = usePlanTransactions(plan?.id);

  const items = plan?.budget_plan_items || [];
  const budget = plan?.total_budget ?? 0;
  const spent = spending?.spent ?? 0;
  const left = budget - spent;
  // Planned = sum of item estimates. Unallocated = budget not given to any item yet.
  const planned = items.reduce((sum, item) => sum + Number(item.estimate || 0), 0);
  const unallocated = budget - planned;
  const itemName = new Map(items.map(i => [i.id, i.name]));

  const handleUpdateStatus = async (status: BudgetPlan['status']) => {
    if (!plan) return;
    try {
      const { error } = await supabase
        .from('budget_plans')
        .update({ status })
        .eq('id', plan.id);
      if (error) throw error;
      onStatusChange(plan, status);
      toast.success('Status updated');
    } catch (error: any) {
      toast.error('Failed to update status');
    }
  };

  return (
    <AnimatePresence>
      {plan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-card w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col sm:rounded-3xl border border-border"
          >
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black">{plan.title}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-2 hover:bg-accent rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Budget vs real spending */}
              <div className="bg-accent/40 rounded-2xl p-4 sm:p-5 border border-border/50 space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">Budget</p>
                    <p className="text-sm sm:text-lg font-black leading-none">{formatCurrency(budget)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">Spent</p>
                    <p className="text-sm sm:text-lg font-black leading-none">{formatCurrency(spent)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">{left < 0 ? 'Over budget' : 'Left'}</p>
                    <p className={`text-sm sm:text-lg font-black leading-none ${left < 0 ? 'text-rose-500' : 'text-primary'}`}>
                      {left < 0 ? `-${formatCurrency(Math.abs(left))}` : formatCurrency(left)}
                    </p>
                  </div>
                </div>
                <Bar value={spent} max={budget} className="h-2.5" />
                {items.length > 0 && (
                <div className="pt-3 border-t border-border/50 flex justify-between items-center gap-3 text-[11px] font-bold text-muted-foreground">
                  <span>Planned {formatCurrency(planned)} in {items.length} {items.length === 1 ? 'item' : 'items'}</span>
                  <span className={unallocated < 0 ? 'text-rose-500' : ''}>
                    {unallocated < 0 ? `Items exceed budget by ${formatCurrency(Math.abs(unallocated))}` : `${formatCurrency(unallocated)} unallocated`}
                  </span>
                </div>
                )}
              </div>

              {/* Status update */}
              <div className="space-y-2">
                <p className="text-xs font-black text-muted-foreground">Change Status</p>
                <div className="flex gap-2 flex-wrap">
                  {(Object.keys(statusConfig) as Array<BudgetPlan['status']>).map(s => (
                    <button
                      key={s}
                      onClick={() => handleUpdateStatus(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${plan.status === s ? statusConfig[s].className + ' ring-2 ring-offset-1 ring-current' : 'bg-accent text-muted-foreground hover:bg-accent/80'}`}
                    >
                      {statusConfig[s].icon} {statusConfig[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items: estimate vs real spending — only for plans that have items (they are optional) */}
              {items.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground px-1">Budget Details</h4>
                <div className="bg-accent/20 rounded-2xl border border-border divide-y divide-border overflow-hidden">
                  {items.map((item) => {
                      const category = item.category_id ? categoryById.get(item.category_id) : undefined;
                      const Icon = category ? getCategoryIcon(category.icon) : guessIcon(item.name);
                      const itemSpent = spending?.byItem[item.id] ?? 0;
                      return (
                        <div key={item.id} className="p-4 space-y-2">
                          <div className="flex justify-between items-center gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="p-2 rounded-lg shrink-0 bg-card shadow-sm text-primary"
                                style={category?.color ? { backgroundColor: category.color + '22', color: category.color } : undefined}
                              >
                                <Icon size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{item.name}</p>
                                {category && <p className="text-[10px] text-muted-foreground">{category.name}</p>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-sm">{formatCurrency(itemSpent)}</p>
                              <p className="text-[10px] text-muted-foreground">of {formatCurrency(Number(item.estimate || 0))}</p>
                            </div>
                          </div>
                          <Bar value={itemSpent} max={Number(item.estimate || 0)} />
                        </div>
                      );
                    })}
                  {(spending?.unitemized ?? 0) > 0 && (
                    <div className="p-4 flex justify-between items-center gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-card shadow-sm text-muted-foreground"><ReceiptText size={14} /></div>
                        <div>
                          <p className="font-bold text-sm">Other spending</p>
                          <p className="text-[10px] text-muted-foreground">Expenses not tied to one of the items above</p>
                        </div>
                      </div>
                      <p className="font-black text-sm">{formatCurrency(spending!.unitemized)}</p>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Linked expenses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black text-muted-foreground">Spending ({spending?.count ?? 0})</h4>
                  {(spending?.count ?? 0) > expenses.length && (
                    <span className="text-[10px] text-muted-foreground">Latest {expenses.length} of {spending!.count}</span>
                  )}
                </div>
                <div className="bg-accent/20 rounded-2xl border border-border divide-y divide-border overflow-hidden">
                  {expensesPending ? (
                    <div className="p-4 space-y-2 animate-pulse">
                      <div className="h-3 w-2/3 rounded bg-accent" /><div className="h-3 w-1/2 rounded bg-accent" />
                    </div>
                  ) : expenses.length === 0 ? (
                    <p className="p-4 text-sm text-center text-muted-foreground">
                      No spending yet. When you record an expense, pick this plan in the "Plan" field — it shows up here with its description. No need to add items first.
                    </p>
                  ) : (
                    expenses.map(t => (
                      <div key={t.id} className="px-4 py-3 flex justify-between items-center gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{t.description || t.transaction_category?.name || 'Expense'}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {new Date(t.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {t.budget_plan_item_id && itemName.get(t.budget_plan_item_id) ? ` · ${itemName.get(t.budget_plan_item_id)}` : ''}
                          </p>
                        </div>
                        <p className="text-sm font-black text-rose-600 dark:text-rose-400 shrink-0">-{formatCurrency(Number(t.amount || 0))}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={onEditRequest}
                  className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground py-3 rounded-2xl font-bold transition-all"
                >
                  Edit Plan
                </button>
                <button
                  onClick={() => onDuplicateRequest(plan)}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent/80 text-accent-foreground py-3 rounded-2xl font-bold transition-all"
                  title="Create a new plan with the same items"
                >
                  <Copy size={16} /> Duplicate
                </button>
                <button
                  onClick={() => onDeleteRequest(plan)}
                  aria-label="Delete plan"
                  className="p-3 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 rounded-2xl transition-all"
                >
                  <Trash2 size={24} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
