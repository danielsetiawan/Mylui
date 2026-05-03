import React, { useState, useEffect } from 'react';
import { Edit2, ListTree, X, Save, Trash2, Plus, ArrowRightLeft, Link2, Repeat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { Transaction, TransactionType } from '../../lib/types';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletCategory } from '../../contexts/WalletCategoryContext';
import { QuickSelectWithAdd } from '../../components/QuickSelectWithAdd';
import { useMonthRange } from '../../contexts/MonthRangeContext';
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
  const { wallets, categories, addWallet, addCategory } = useWalletCategory();

  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editAmount, setEditAmount] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editWalletId, setEditWalletId] = useState('');
  const [editToWalletId, setEditToWalletId] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editLinkedIncomeId, setEditLinkedIncomeId] = useState('');
  const [editIncomeMonth, setEditIncomeMonth] = useState(new Date().toISOString().substring(0, 7));
  const [localIncomeSources, setLocalIncomeSources] = useState<Transaction[]>([]);
  const { monthOptions } = useMonthRange();
  const [editDetails, setEditDetails] = useState<{ id?: string; name: string; amount: number | '' }[]>([]);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const incomeCategories = categories.filter(c => c.type === 'income');

  useEffect(() => {
    if (transaction) {
      setEditType(transaction.type as TransactionType);
      setEditAmount(transaction.amount.toString());
      setEditCategoryId(transaction.category_id || '');
      setEditWalletId(transaction.wallet_id || '');
      setEditToWalletId(transaction.to_wallet_id || '');
      setEditDescription(transaction.description || '');
      setEditDate(transaction.date);
      setEditLinkedIncomeId(transaction.linked_income_id || '');
      // *** BUG FIX: Use the linked income's month, NOT the expense's month ***
      // If we use the expense month, the income won't appear in the dropdown
      const linkedMonth = transaction.linked_income?.date?.substring(0, 7);
      setEditIncomeMonth(linkedMonth || transaction.date.substring(0, 7));
      setEditDetails((transaction.transaction_details || []).map(d => ({
        id: d.id,
        name: d.name || d?.text || '',
        amount: d.amount || ''
      })));
    }
  }, [transaction]);

  useEffect(() => {
    if (!user || editType !== 'expense' || !transaction) return;
    const fetchIncomes = async () => {
      const parts = editIncomeMonth.split('-');
      const year = parseInt(parts[0]); const month = parseInt(parts[1]);
      const lastDay = new Date(year, month, 0).getDate();
      const { data } = await supabase
        .from('transactions').select('*').eq('user_id', user.id).eq('type', 'income')
        .gte('date', `${editIncomeMonth}-01`).lte('date', `${editIncomeMonth}-${lastDay}`)
        .order('date', { ascending: false });
      if (data) setLocalIncomeSources(data as Transaction[]);
    };
    fetchIncomes();
  }, [editIncomeMonth, editType, user, transaction]);

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    try {
      const payload: any = {
        type: editType,
        amount: parseFloat(editAmount),
        description: editDescription,
        date: editDate,
        wallet_id: editWalletId || null,
        to_wallet_id: editType === 'transfer' ? (editToWalletId || null) : null,
        category_id: editType !== 'transfer' ? (editCategoryId || null) : null,
        linked_income_id: editType === 'expense' ? (editLinkedIncomeId || null) : null,
      };

      const { error: txError } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', transaction.id);

      if (txError) throw txError;

      // Save details
      for (const d of editDetails) {
        if (!d.name.trim() || d.amount === '') continue;
        if (d.id) {
          await supabase.from('transaction_details').update({ name: d.name, amount: d.amount }).eq('id', d.id);
        } else {
          await supabase.from('transaction_details').insert({ transaction_id: transaction.id, name: d.name, amount: d.amount });
        }
      }

      onSuccess();
      toast.success('Transaction updated!');
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    }
  };

  const handleRemoveDetail = async (index: number) => {
    const detail = editDetails[index];
    if (detail.id) {
      const { error } = await supabase.from('transaction_details').delete().eq('id', detail.id);
      if (error) { toast.error('Failed to delete detail'); return; }
    }
    setEditDetails(editDetails.filter((_, i) => i !== index));
  };

  const saveDetailsToDb = async () => {
    if (!transaction) return;
    try {
      for (const d of editDetails) {
        if (!d.name.trim() || d.amount === '') continue;
        if (d.id) {
          await supabase.from('transaction_details').update({ name: d.name, amount: d.amount }).eq('id', d.id);
        } else {
          await supabase.from('transaction_details').insert({ transaction_id: transaction.id, name: d.name, amount: d.amount });
        }
      }
      toast.success('Details saved');
      onSuccess();
    } catch (err: any) {
      toast.error('Failed to save details');
    }
  };

  const tabStyle = (t: TransactionType) =>
    `px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${editType === t
      ? t === 'income' ? 'bg-white shadow-sm text-emerald-600'
        : t === 'transfer' ? 'bg-white shadow-sm text-blue-600'
          : 'bg-white shadow-sm text-rose-600'
      : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <AnimatePresence>
      {transaction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card w-full max-w-2xl border border-border shadow-2xl rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex justify-between items-center bg-accent/30">
              <h3 className="font-black text-lg flex items-center gap-2">
                <Edit2 size={18} className="text-primary" /> Edit Activity
              </h3>
              <button onClick={onClose} className="p-2 text-muted-foreground hover:bg-accent rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Tab Switcher */}
              <div className="flex p-1 bg-accent rounded-xl w-fit gap-0.5">
                <button type="button" onClick={() => setEditType('expense')} className={tabStyle('expense')}>Expense</button>
                <button type="button" onClick={() => setEditType('income')} className={tabStyle('income')}>Income</button>
                <button type="button" onClick={() => setEditType('transfer')} className={tabStyle('transfer')}>
                  <span className="flex items-center gap-1"><Repeat size={13} /> Transfer</span>
                </button>
              </div>

              <form id="editForm" onSubmit={handleEditSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* LEFT */}
                <div className="space-y-4">
                  {/* Amount */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Amount</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">Rp</span>
                      <input
                        type="text" inputMode="numeric"
                        value={editAmount.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                        onChange={e => setEditAmount(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-accent/50 border-none rounded-2xl py-3 pl-10 pr-4 font-black text-xl outline-none focus:ring-2 ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Wallet From */}
                  <QuickSelectWithAdd
                    label={editType === 'transfer' ? 'From Wallet' : 'Wallet / Sumber'}
                    value={editWalletId}
                    options={wallets}
                    onChange={setEditWalletId}
                    onAdd={async name => addWallet({ name, icon: 'Wallet', color: '#10b981', balance: 0 })}
                    placeholder="Pilih wallet..."
                  />

                  {/* To Wallet */}
                  {editType === 'transfer' && (
                    <QuickSelectWithAdd
                      label="To Wallet"
                      value={editToWalletId}
                      options={wallets.filter(w => w.id !== editWalletId)}
                      onChange={setEditToWalletId}
                      onAdd={async name => addWallet({ name, icon: 'Wallet', color: '#3b82f6', balance: 0 })}
                      placeholder="Pilih tujuan..."
                    />
                  )}

                  {/* Category */}
                  {editType !== 'transfer' && (
                    <QuickSelectWithAdd
                      label="Category"
                      value={editCategoryId}
                      options={editType === 'expense' ? expenseCategories : incomeCategories}
                      onChange={setEditCategoryId}
                      onAdd={async name => addCategory({ name, icon: 'Tag', color: '#64748b', type: editType as 'income' | 'expense' })}
                      placeholder="Pilih kategori..."
                    />
                  )}

                  {/* Link to Income — only for expense */}
                  {editType === 'expense' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                          <Link2 size={12} /> Link to Income <span className="font-normal opacity-60">(opsional)</span>
                        </label>
                        <select
                          value={editIncomeMonth}
                          onChange={e => setEditIncomeMonth(e.target.value)}
                          className="text-xs font-bold bg-accent/50 border-none rounded-lg py-1 px-2 outline-none appearance-none cursor-pointer"
                        >
                          {monthOptions.map(({ value, label }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <select
                        value={editLinkedIncomeId}
                        onChange={e => setEditLinkedIncomeId(e.target.value)}
                        className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
                      >
                        <option value="">Tidak ditautkan</option>
                        {localIncomeSources.map(src => (
                          <option key={src.id} value={src.id}>
                            {src.description || src.category} ({src.amount.toLocaleString('id-ID')})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* RIGHT */}
                <div className="space-y-4">
                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Date</label>
                    <div className="relative group">
                      <div className="absolute inset-0 bg-accent/50 rounded-2xl py-3 px-4 font-bold flex items-center pointer-events-none">
                        {(editDate || '').split('-').reverse().join('/')}
                      </div>
                      <input
                        type="date" value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        onClick={e => { (e.target as any).showPicker?.(); }}
                        className="w-full bg-transparent border-none rounded-2xl py-3 px-4 font-bold outline-none opacity-0 cursor-pointer h-[52px]"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Description / Notes</label>
                    <textarea
                      value={editDescription}
                      onChange={e => setEditDescription(e.target.value)}
                      rows={4}
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 resize-none"
                    />
                  </div>
                </div>
              </form>

              {/* Details Section */}
              {editType !== 'transfer' && (
                <>
                  <hr className="border-border" />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-muted-foreground flex items-center gap-2">
                        <ListTree size={16} /> Detail Items
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditDetails([{ name: '', amount: '' }, ...editDetails])}
                        className="text-primary text-xs font-black flex items-center gap-1 hover:underline bg-primary/10 px-2 py-1 rounded"
                      >
                        <Plus size={14} /> Add Detail
                      </button>
                    </div>

                    <div className="bg-accent/40 p-3 rounded-xl flex items-center justify-between border border-border">
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Total Rincian</span>
                      <span className="font-black text-primary">
                        Rp {editDetails.reduce((acc, d) => acc + (Number(d.amount) || 0), 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
                      </span>
                    </div>

                    {editDetails.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No details yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {editDetails.map((det, index) => (
                          <div key={index} className="flex items-center gap-2 bg-accent/20 p-2 rounded-xl group">
                            <div className="relative flex items-center w-32 shrink-0">
                              <span className="absolute left-3 text-xs font-black text-muted-foreground">Rp</span>
                              <input
                                type="text" inputMode="numeric"
                                value={det.amount ? det.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''}
                                onChange={e => { const a = [...editDetails]; a[index].amount = parseInt(e.target.value.replace(/\D/g, ''), 10) || ''; setEditDetails(a); }}
                                placeholder="0"
                                className="w-full bg-background border border-border rounded-lg py-2 pl-8 pr-2 text-sm font-black outline-none focus:border-primary"
                              />
                            </div>
                            <input
                              type="text" value={det.name}
                              onChange={e => { const a = [...editDetails]; a[index].name = e.target.value; setEditDetails(a); }}
                              placeholder="Keterangan..."
                              className="flex-1 bg-background border border-border rounded-lg py-2 px-3 text-sm font-semibold outline-none focus:border-primary"
                            />
                            <button onClick={() => handleRemoveDetail(index)} type="button" className="text-muted-foreground hover:text-rose-500 p-1.5">
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button onClick={saveDetailsToDb} type="button" className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-emerald-200 font-bold">
                        <Save size={12} /> Save Details Only
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-accent/30 flex gap-4">
              <button type="submit" form="editForm" className="w-full bg-primary text-primary-foreground py-3.5 rounded-2xl font-black transition-all hover:bg-primary/90">
                Save All Changes
              </button>
              <button
                type="button"
                onClick={() => onDeleteRequest(transaction!.id)}
                className="px-6 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl transition-all shrink-0 flex items-center justify-center font-bold"
              >
                <Trash2 size={22} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
