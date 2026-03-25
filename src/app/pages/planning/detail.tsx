import React from 'react';
import { X, Target, Trash2, Clock, CheckCircle2, Plane, ShoppingBag, Bus, Utensils, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { BudgetPlan } from '../../lib/types';
import { toast } from 'sonner';

interface Props {
  plan: BudgetPlan | null;
  onClose: () => void;
  onEditRequest: () => void;
  onDeleteRequest: (plan: BudgetPlan) => void;
  onStatusChange: (plan: BudgetPlan, status: BudgetPlan['status']) => void;
  formatCurrency: (val: number) => string;
  formatCompactCurrency: (val: number) => string;
}

const statusConfig = {
  planning: { label: 'Planning', className: 'bg-amber-100 text-amber-700', icon: <Clock size={10} /> },
  active: { label: 'Active', className: 'bg-blue-100 text-blue-700', icon: <Target size={10} /> },
  completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 size={10} /> },
};

export function PlanningDetail({ plan, onClose, onEditRequest, onDeleteRequest, onStatusChange, formatCurrency, formatCompactCurrency }: Props) {
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
            className="bg-card border border-border rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-border flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black">{plan.title}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-accent rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="p-3 sm:p-4 bg-accent/50 rounded-xl sm:rounded-2xl overflow-hidden border border-border/50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 truncate">Total</p>
                  <div title={formatCurrency(plan.total_budget)} className="text-xs sm:text-sm font-black text-primary truncate">
                    <span className="sm:hidden">{formatCompactCurrency(plan.total_budget)}</span>
                    <span className="hidden sm:inline">{formatCurrency(plan.total_budget)}</span>
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-accent/50 rounded-xl sm:rounded-2xl overflow-hidden border border-border/50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 truncate">Status</p>
                  <p className="text-[10px] sm:text-sm font-black truncate">{statusConfig[plan.status].label}</p>
                </div>
                <div className="p-3 sm:p-4 bg-accent/50 rounded-xl sm:rounded-2xl overflow-hidden border border-border/50">
                  <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase mb-1 truncate">Items</p>
                  <p className="text-xs sm:text-sm font-black truncate">{(plan.budget_plan_items || []).length}</p>
                </div>
              </div>

              {/* Status update */}
              <div className="space-y-2">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Change Status</p>
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

              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">Budget Details</h4>
                <div className="bg-accent/20 rounded-2xl border border-border divide-y divide-border overflow-hidden">
                  {(plan.budget_plan_items || []).length === 0 ? (
                    <p className="p-4 text-sm text-center text-muted-foreground">No items</p>
                  ) : (
                    (plan.budget_plan_items || []).map((item) => (
                      <div key={item.id} className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            {item.name.toLowerCase().includes('makan') ? <Utensils size={14} className="text-primary" /> :
                             item.name.toLowerCase().includes('transport') || item.name.toLowerCase().includes('bis') ? <Bus size={14} className="text-primary" /> :
                             item.name.toLowerCase().includes('tiket') || item.name.toLowerCase().includes('pesawat') ? <Plane size={14} className="text-primary" /> :
                             item.name.toLowerCase().includes('belanja') ? <ShoppingBag size={14} className="text-primary" /> :
                             <AlertCircle size={14} className="text-primary" />}
                          </div>
                          <span className="font-bold text-sm">{item.name}</span>
                        </div>
                        <span className="font-black text-sm">{formatCurrency(item.estimate)}</span>
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
                  onClick={() => onDeleteRequest(plan)}
                  className="p-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl transition-all"
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
