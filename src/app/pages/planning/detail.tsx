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
  const items = plan?.budget_plan_items || [];
  const totalEstimate = items.reduce((sum, item) => sum + item.estimate, 0);
  const sisaValue = (plan?.total_budget ?? 0) - totalEstimate;
  const progress = plan && plan.total_budget > 0 ? (totalEstimate / plan.total_budget) * 100 : 0;
  
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
              <button onClick={onClose} className="p-2 hover:bg-accent rounded-full">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Budget Progress (Matching Mobile) */}
              <div className="bg-accent/40 rounded-2xl p-4 sm:p-5 border border-border/50">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    {(plan.budget_plan_items || []).length} items • Used
                  </span>
                  <span className={`text-xs font-black ${sisaValue < 0 ? 'text-rose-500' : 'text-primary'}`}>
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-primary/10 rounded-full mb-4 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${sisaValue < 0 ? 'bg-rose-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">Estimate</p>
                    <div title={formatCurrency(totalEstimate)} className="text-sm sm:text-lg font-black text-foreground leading-none">
                      {formatCurrency(totalEstimate)}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-muted-foreground mb-1">Remaining Budget</p>
                    <div title={formatCurrency(sisaValue)} className={`text-sm sm:text-lg font-black leading-none ${sisaValue < 0 ? 'text-rose-500' : 'text-primary'}`}>
                      {sisaValue < 0 ? `-${formatCurrency(Math.abs(sisaValue))}` : formatCurrency(sisaValue)}
                    </div>
                  </div>
                </div>
                {/* Visual indicator for Target Budget to remind user */}
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Target Budget</span>
                  <span className="text-xs font-black text-muted-foreground">{formatCurrency(plan.total_budget)}</span>
                </div>
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

              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground px-1">Budget Details</h4>
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
