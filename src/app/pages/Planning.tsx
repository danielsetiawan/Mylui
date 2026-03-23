import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  CalendarDays, 
  ChevronRight, 
  Target, 
  MoreHorizontal,
  PlusCircle,
  X,
  Plane,
  ShoppingBag,
  Bus,
  Utensils,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as kv from '../lib/kv_client';
import { BudgetPlan, BudgetPlanItem } from '../lib/types';
import { toast } from 'sonner';
import { ConfirmationDialog } from '../components/ConfirmationDialog';

export function Planning() {
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BudgetPlan | null>(null);
  
  // Delete Dialog State
  const [planToDelete, setPlanToDelete] = useState<BudgetPlan | null>(null);

  // New Plan State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newItems, setNewItems] = useState<Partial<BudgetPlanItem>[]>([]);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const stored = await kv.getByPrefix('plan:');
      setPlans(stored as BudgetPlan[]);
    } catch (error) {
      console.error('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error('Judul rencana harus diisi');
      return;
    }

    const items: BudgetPlanItem[] = newItems
      .filter(item => item.name && item.estimate)
      .map(item => ({
        id: `item:${Date.now()}:${Math.random()}`,
        name: item.name!,
        estimate: parseFloat(item.estimate!.toString())
      }));

    const totalBudget = items.reduce((acc, item) => acc + item.estimate, 0);

    const newPlan: BudgetPlan = {
      id: `plan:${Date.now()}`,
      title,
      description,
      items,
      totalBudget,
      status: 'planning'
    };

    try {
      await kv.set(newPlan.id, newPlan);
      setPlans([newPlan, ...plans]);
      setIsCreating(false);
      resetForm();
      toast.success('Rencana anggaran dibuat!');
    } catch (error) {
      toast.error('Gagal membuat rencana');
    }
  };

  const addItem = () => {
    setNewItems([...newItems, { name: '', estimate: 0 }]);
  };

  const updateItem = (index: number, field: keyof BudgetPlanItem, value: any) => {
    const updated = [...newItems];
    updated[index] = { ...updated[index], [field]: value };
    setNewItems(updated);
  };

  const removeItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setNewItems([]);
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    try {
      await kv.del(planToDelete.id);
      setPlans(plans.filter(p => p.id !== planToDelete.id));
      if (selectedPlan?.id === planToDelete.id) {
        setSelectedPlan(null);
      }
      toast.success('Rencana dihapus');
    } catch (error) {
      toast.error('Gagal menghapus');
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

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="space-y-8 pb-10"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Perencanaan</h1>
          <p className="text-muted-foreground">Rencanakan anggaran untuk kegiatan spesifik Anda.</p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/20"
        >
          <PlusCircle size={20} />
          Buat Rencana Baru
        </button>
      </header>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-20 text-muted-foreground font-medium">Memuat rencana...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-2 bg-card border border-border border-dashed rounded-3xl p-12 text-center flex flex-col items-center gap-4">
            <div className="p-4 bg-accent rounded-full text-muted-foreground opacity-30">
              <CalendarDays size={48} />
            </div>
            <div className="max-w-xs">
              <h3 className="font-bold text-lg">Belum ada rencana</h3>
              <p className="text-sm text-muted-foreground mt-1">Buat estimasi anggaran untuk liburan, renovasi, atau hobi Anda.</p>
            </div>
            <button 
              onClick={() => setIsCreating(true)}
              className="mt-4 text-primary font-bold hover:underline"
            >
              Mulai Merencanakan
            </button>
          </div>
        ) : (
          plans.map((plan) => (
            <div 
              key={plan.id}
              onClick={() => setSelectedPlan(plan)}
              className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-accent rounded-2xl text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Target size={24} />
                </div>
                <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${plan.status === 'planning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {plan.status === 'planning' ? 'Dalam Perencanaan' : 'Aktif'}
                </div>
              </div>
              <div>
                <h3 className="font-black text-xl mb-1">{plan.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1 mb-4">{plan.description || 'Tidak ada deskripsi'}</p>
                <div className="flex items-end justify-between border-t border-border pt-4">
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Total Estimasi</p>
                    <p className="text-lg font-black text-primary">{formatCurrency(plan.totalBudget)}</p>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Creating Plan */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h3 className="text-xl font-black">Buat Rencana Anggaran Baru</h3>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-accent rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreatePlan} className="p-6 overflow-y-auto space-y-6 flex-1">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Judul Rencana</label>
                    <input 
                      type="text" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Misal: Liburan ke Bali, Renovasi Kamar"
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Deskripsi Singkat</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Keterangan tambahan..."
                      className="w-full bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-muted-foreground uppercase tracking-wider">Item Anggaran (Estimasi)</label>
                    <button 
                      type="button" 
                      onClick={addItem}
                      className="text-primary text-xs font-black flex items-center gap-1 hover:underline"
                    >
                      <Plus size={14} /> Tambah Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {newItems.length === 0 && (
                      <p className="text-sm text-center py-6 text-muted-foreground bg-accent/30 rounded-2xl border border-dashed border-border">Belum ada item anggaran.</p>
                    )}
                    {newItems.map((item, index) => (
                      <div key={index} className="flex gap-3 items-center">
                        <div className="flex-1">
                          <input 
                            type="text" 
                            value={item.name}
                            onChange={(e) => updateItem(index, 'name', e.target.value)}
                            placeholder="Nama item (Misal: Tiket Pesawat)"
                            className="w-full bg-accent/50 border-none rounded-xl py-2 px-3 text-sm font-bold outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <input 
                            type="number" 
                            value={item.estimate}
                            onChange={(e) => updateItem(index, 'estimate', e.target.value)}
                            placeholder="Rp 0"
                            className="w-full bg-accent/50 border-none rounded-xl py-2 px-3 text-sm font-black outline-none"
                          />
                        </div>
                        <button type="button" onClick={() => removeItem(index)} className="p-2 text-muted-foreground hover:text-rose-600 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border mt-4">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-sm font-bold text-muted-foreground">Total Anggaran:</span>
                    <span className="text-2xl font-black text-primary">
                      {formatCurrency(newItems.reduce((acc, item) => acc + (parseFloat(item.estimate?.toString() || '0') || 0), 0))}
                    </span>
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-black text-lg transition-all hover:bg-primary/90"
                  >
                    Simpan Rencana
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Plan Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="bg-card border border-border rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-border flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black">{selectedPlan.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedPlan.description}</p>
                </div>
                <button onClick={() => setSelectedPlan(null)} className="p-2 hover:bg-accent rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-accent/50 rounded-2xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Total</p>
                    <p className="text-sm font-black">{formatCurrency(selectedPlan.totalBudget)}</p>
                  </div>
                  <div className="p-4 bg-accent/50 rounded-2xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status</p>
                    <p className="text-sm font-black">Planning</p>
                  </div>
                  <div className="p-4 bg-accent/50 rounded-2xl">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Item</p>
                    <p className="text-sm font-black">{selectedPlan.items.length}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider px-1">Rincian Anggaran</h4>
                  <div className="bg-accent/20 rounded-2xl border border-border divide-y divide-border overflow-hidden">
                    {selectedPlan.items.map((item) => (
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
                    ))}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      toast.info('Fitur edit segera hadir!');
                    }}
                    className="flex-1 bg-accent hover:bg-accent/80 text-accent-foreground py-3 rounded-2xl font-bold transition-all"
                  >
                    Ubah Rencana
                  </button>
                  <button 
                    onClick={() => {
                      setPlanToDelete(selectedPlan);
                    }}
                    className="p-3 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationDialog 
        isOpen={!!planToDelete}
        title="Hapus Rencana"
        message="Apakah Anda yakin ingin menghapus rencana anggaran ini? Data tidak dapat dikembalikan."
        onConfirm={handleDeletePlan}
        onCancel={() => setPlanToDelete(null)}
      />
    </motion.div>
  );
}
