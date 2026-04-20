import React, { useState } from 'react';
import { Wallet, Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useWalletCategory } from '../../contexts/WalletCategoryContext';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { toast } from 'sonner';
import { Wallet as WalletType } from '../../lib/types';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#64748b'];

export function WalletsPage() {
  const { wallets, addWallet, refreshWallets } = useWalletCategory();
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const result = await addWallet({ name: newName.trim(), icon: 'Wallet', color: newColor, balance: 0 });
    setSaving(false);
    if (result) {
      toast.success('Wallet added!');
      setNewName(''); setIsAdding(false);
    } else {
      toast.error('Failed to add wallet');
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('wallets').update({ name: editName.trim(), color: editColor }).eq('id', id);
    if (error) { toast.error('Failed to update'); return; }
    await refreshWallets();
    toast.success('Wallet updated!');
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('wallets').delete().eq('id', deleteId);
    if (error) { toast.error('Failed to delete'); return; }
    await refreshWallets();
    toast.success('Wallet deleted');
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
            <Wallet className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Wallets</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Kelola sumber pembayaran & rekening kamu</p>
          </div>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <Plus size={18} /> Tambah
        </button>
      </div>

      {/* Add Form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Wallet Baru</h3>
              <input
                type="text" autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
                placeholder="Nama wallet (e.g. Blu by BCA, GoPay...)"
                className="w-full bg-accent/50 border-none rounded-xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Warna:</span>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${newColor === c ? 'scale-125 border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving || !newName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold disabled:opacity-50 transition-all">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Simpan
                </button>
                <button onClick={() => { setIsAdding(false); setNewName(''); }}
                  className="px-4 py-2.5 bg-accent text-muted-foreground rounded-xl font-bold hover:bg-accent/80 transition-all">
                  Batal
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wallet List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {wallets.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Belum ada wallet. Tambahkan wallet pertama kamu!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {wallets.map(w => (
              <div key={w.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: w.color + '22' }}>
                  <Wallet size={20} style={{ color: w.color }} />
                </div>
                {editingId === w.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text" autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleUpdate(w.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 bg-accent/50 border-none rounded-xl py-2 px-3 font-bold outline-none focus:ring-2 ring-primary/20 text-sm"
                    />
                    <div className="flex gap-1">
                      {COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded-full border-2 ${editColor === c ? 'border-foreground scale-125' : 'border-transparent'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <button onClick={() => handleUpdate(w.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-muted-foreground hover:bg-accent rounded-lg"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <p className="font-bold">{w.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingId(w.id); setEditName(w.name); setEditColor(w.color); }}
                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => setDeleteId(w.id)}
                        className="p-2 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationDialog
        isOpen={!!deleteId}
        title="Hapus Wallet"
        message="Yakin mau hapus wallet ini? Transaksi yang terhubung tidak akan ikut terhapus."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
