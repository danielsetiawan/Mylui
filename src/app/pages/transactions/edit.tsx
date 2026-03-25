import React, { useState, useEffect } from 'react';
import { Edit2, Link2, ListTree, X, Save, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Transaction, TransactionType } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  onSuccess: () => void;
  onDeleteRequest: (id: string) => void;
  formatCurrency: (val: number) => string;
}

export function TransactionEdit({ transaction, onClose, onSuccess, onDeleteRequest, formatCurrency }: Props) {
  const { user } = useAuth();
  
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLinkedIncomeId, setEditLinkedIncomeId] = useState('');
  const [editDetails, setEditDetails] = useState<{ id?: string, text: string }[]>([]);

  // Income Sources State
  const [incomeMonth, setIncomeMonth] = useState(new Date().toISOString().substring(0, 7));
  const [localIncomeSources, setLocalIncomeSources] = useState<Transaction[]>([]);

  useEffect(() => {
    if (transaction) {
      setEditType(transaction.type);
      setEditAmount(transaction.amount.toString());
      setEditCategory(transaction.category);
      setEditDescription(transaction.description || '');
      setEditDate(transaction.date);
      setEditLinkedIncomeId(transaction.linked_income_id || '');
      setEditDetails((transaction.transaction_details || []).map(d => ({ id: d.id, text: d.text })));
      // Set initial income month to transaction date month
      setIncomeMonth(transaction.date.substring(0, 7));
    }
  }, [transaction]);

  useEffect(() => {
    if (!user || editType !== 'expense' || !transaction) return;
    
    const fetchIncomes = async () => {
      const [year, month] = incomeMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'income')
        .gte('date', `${incomeMonth}-01`)
        .lte('date', `${incomeMonth}-${lastDay}`)
        .order('date', { ascending: false });
        
      if (data) setLocalIncomeSources(data as Transaction[]);
    };
    
    fetchIncomes();
  }, [incomeMonth, editType, user, transaction]);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    try {
      // 1. Update main transaction
      const payload: any = {
        type: editType,
        amount: parseFloat(editAmount),
        category: editCategory,
        description: editDescription,
        date: editDate,
        linked_income_id: editType === 'expense' ? (editLinkedIncomeId || null) : null
      };

      const { error: txError } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', transaction.id);

      if (txError) throw txError;

      // 2. Simpan rincian juga bersamaan dengan simpan utama
      for (const d of editDetails) {
        if (!d.text.trim()) continue;
        if (d.id) {
          await supabase.from('transaction_details').update({ text: d.text }).eq('id', d.id);
        } else {
          await supabase.from('transaction_details').insert({ transaction_id: transaction.id, text: d.text });
        }
      }

      onSuccess();
      toast.success('Transaction updated successfully');
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
    }
  };

  const handleAddDetail = () => {
    setEditDetails([{ text: '' }, ...editDetails]);
  };

  const handleRemoveDetail = async (index: number) => {
    const detail = editDetails[index];
    if (detail.id) {
      try {
        await supabase.from('transaction_details').delete().eq('id', detail.id);
      } catch (err: any) {
        toast.error('Failed to delete detail from database');
        return;
      }
    }
    const newArr = [...editDetails];
    newArr.splice(index, 1);
    setEditDetails(newArr);
  };

  const handleUpdateDetail = async (index: number, val: string) => {
    const newArr = [...editDetails];
    newArr[index].text = val;
    setEditDetails(newArr);
  };

  const saveDetailsToDb = async () => {
    if (!transaction) return;
    try {
      for (const d of editDetails) {
        if (!d.text.trim()) continue;
        if (d.id) {
          await supabase.from('transaction_details').update({ text: d.text }).eq('id', d.id);
        } else {
          await supabase.from('transaction_details').insert({ transaction_id: transaction.id, text: d.text });
        }
      }
      toast.success('Details saved');
      onSuccess();
    } catch (err: any) {
      toast.error('Failed to save details');
    }
  };

  return (
    <AnimatePresence>
      {transaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-4 border-b border-border flex justify-between items-center bg-accent/30">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Edit2 size={18} className="text-primary" /> Edit Transaction & Details
              </h3>
              <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-8 flex-1">
              <form id="editForm" onSubmit={handleEditSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editAmount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        onChange={(e) => setEditAmount(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-accent/50 border-none rounded-2xl py-3 pl-10 pr-4 font-black outline-none focus:ring-2 ring-primary/20"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Note (Category)</label>
                    <textarea
                      value={editCategory} onChange={(e) => setEditCategory(e.target.value)}
                      rows={2}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                    />
                  </div>
                  {editType === 'expense' && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Link2 size={12} /> Link to Income
                        </label>
                        <select 
                          value={incomeMonth} 
                          onChange={(e) => setIncomeMonth(e.target.value)}
                          className="bg-accent/50 border-none rounded-xl py-1.5 px-3 pr-8 text-xs font-bold outline-none focus:ring-2 ring-primary/20 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M5%207.5L10%2012.5L15%207.5%22%20fill%3D%22none%22%20stroke%3D%22%23717182%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.2em_1.2em] bg-[right_0.5rem_center] bg-no-repeat cursor-pointer"
                        >
                          {Array.from({ length: 12 }).map((_, i) => {
                            const d = new Date();
                            d.setMonth(d.getMonth() - i);
                            const val = d.toISOString().substring(0, 7);
                            const label = new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric' }).format(d);
                            return <option key={val} value={val}>{label}</option>;
                          })}
                        </select>
                      </div>
                      <select
                        value={editLinkedIncomeId}
                        onChange={(e) => setEditLinkedIncomeId(e.target.value)}
                        className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
                      >
                        <option value="">Not Linked</option>
                        {localIncomeSources.map(source => (
                          <option key={source.id} value={source.id}>
                            {source.category} ({formatCurrency(source.amount)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-accent/50 rounded-2xl py-3 px-4 font-bold flex items-center pointer-events-none peer-focus:ring-2 ring-primary/20">
                        {(editDate || '').split('-').reverse().join('/')}
                      </div>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        onClick={(e) => { (e.target as any).showPicker && (e.target as any).showPicker(); }}
                        className="w-full bg-transparent border-none rounded-2xl py-3 px-4 font-bold outline-none opacity-0 cursor-pointer h-[52px]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Additional Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                    />
                  </div>
                </div>
              </form>

              <hr className="border-border" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ListTree size={16} /> Transaction Details (Split)
                  </label>
                  <button type="button" onClick={handleAddDetail} className="text-primary text-xs font-black flex items-center gap-1 hover:underline bg-primary/10 px-2 py-1 rounded">
                    <Plus size={14} /> Add Detail
                  </button>
                </div>

                {editDetails.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No details. You can split expense notes here.</p>
                ) : (
                  <div className="space-y-2">
                    {editDetails.map((det, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          type="text" value={det.text}
                          onChange={(e) => handleUpdateDetail(index, e.target.value)}
                          placeholder="Misal: 2k parkir, 50k bensin..."
                          className="flex-1 bg-background border border-border rounded-xl py-2 px-3 text-sm font-medium outline-none focus:border-primary"
                        />
                        <button onClick={() => handleRemoveDetail(index)} type="button" className="text-muted-foreground hover:text-rose-500 p-2">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button onClick={saveDetailsToDb} type="button" className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-200 mt-2 font-bold transition-colors">
                      <Save size={12} /> Save Details Only
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-accent/30 flex gap-4">
              <button type="submit" form="editForm" className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-black transition-all hover:bg-primary/90">
                Save All Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteRequest(transaction.id);
                }}
                className="px-6 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl transition-all shrink-0 flex items-center justify-center font-bold"
              >
                <Trash2 size={24} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
