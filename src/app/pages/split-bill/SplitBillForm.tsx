import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Split, PlusCircle, Trash2, Save, RefreshCw, Calculator, ChevronDown, ChevronUp, Receipt, X,
  Users, UserPlus, Check, AlertCircle, Pencil,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import {
  BillItem, BillPerson, ModifierType, Modifiers, calculateSplit, expandItems,
} from './calculate';

/**
 * Split bill editor, used for both a new bill (`bill` undefined) and editing.
 *
 * Flow: 1. type every line of the receipt, 2. list the people, 3. pick a person
 * and tick what they had. An item ticked by several people is shared equally.
 * Saving writes one split_bill_details row per (person, item share) — the same
 * format as before, so old bills and the mobile app keep working.
 */

const newId = () => crypto.randomUUID();
type ItemDraft = { name: string; qty: number; price: number };
const emptyDraft = (): ItemDraft => ({ name: '', qty: 1, price: 0 });

const formatIDR = (num: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(num));

const digitsOnly = (value: string) => Number(value.replace(/[^0-9]/g, ''));
const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

// Avatar colours, picked by position so each person keeps the same colour
const PERSON_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#64748b'];

// Custom input for % / Rp toggles
const ModifierInput = ({
  label, type, value, onTypeChange, onValueChange, colorClass,
}: {
  label: string, type: ModifierType, value: number,
  onTypeChange: (t: ModifierType) => void, onValueChange: (v: number) => void,
  colorClass: string
}) => (
  <div className="flex flex-col gap-1.5 p-3 sm:p-4 rounded-xl border border-border bg-card">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-muted-foreground uppercase">{label}</span>
      <div className="flex bg-accent/50 p-0.5 rounded-lg border border-border/50">
        <button
          type="button"
          onClick={() => { onTypeChange('percentage'); onValueChange(0); }}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${type === 'percentage' ? 'bg-background shadow-sm text-foreground border border-border/50' : 'text-muted-foreground'}`}
        >
          %
        </button>
        <button
          type="button"
          onClick={() => { onTypeChange('nominal'); onValueChange(0); }}
          className={`px-3 py-1 rounded-md text-[10px] font-bold transition-colors ${type === 'nominal' ? 'bg-background shadow-sm text-foreground border border-border/50' : 'text-muted-foreground'}`}
        >
          Rp
        </button>
      </div>
    </div>
    <div className="relative mt-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className={`text-sm font-bold ${colorClass}`}>{type === 'percentage' ? '%' : 'Rp'}</span>
      </div>
      <input
        type="text" inputMode="numeric" value={value || ''} placeholder="0"
        onChange={(e) => onValueChange(digitsOnly(e.target.value))}
        aria-label={label}
        className="w-full bg-field border-none rounded-lg pl-9 pr-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 tabular-nums"
      />
    </div>
  </div>
);

const FeeInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="flex flex-col gap-1.5 p-3 sm:p-4 rounded-xl border border-border bg-card">
    <span className="text-xs font-bold text-muted-foreground uppercase">{label}</span>
    <div className="relative mt-2">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className="text-sm font-bold text-blue-500">Rp</span>
      </div>
      <input
        type="text" inputMode="numeric" value={value || ''} placeholder="0"
        onChange={(e) => onChange(digitsOnly(e.target.value))}
        aria-label={label}
        className="w-full bg-field border-none rounded-lg pl-9 pr-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 tabular-nums"
      />
    </div>
  </div>
);

export interface SplitBillFormProps {
  /** Existing bill to edit; omit for a new bill */
  bill?: any;
  initialItems?: BillItem[];
  initialPeople?: BillPerson[];
  onClose: () => void;
}

export function SplitBillForm({ bill, initialItems, initialPeople, onClose }: SplitBillFormProps) {
  const { user } = useAuth();
  const isEdit = !!bill;

  const [title, setTitle] = useState<string>(bill?.title ?? 'New Split Bill');
  const [items, setItems] = useState<BillItem[]>(initialItems ?? []);
  const [people, setPeople] = useState<BillPerson[]>(initialPeople ?? []);
  const [activePersonId, setActivePersonId] = useState<string | null>(initialPeople?.[0]?.id ?? null);
  const [newPersonName, setNewPersonName] = useState('');
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [expandedPeople, setExpandedPeople] = useState<string[]>([]);

  const [taxType, setTaxType] = useState<ModifierType>(bill?.tax_type ?? 'percentage');
  const [taxValue, setTaxValue] = useState<number>(bill?.tax_value ?? 0);
  const [serviceType, setServiceType] = useState<ModifierType>(bill?.service_type ?? 'percentage');
  const [serviceValue, setServiceValue] = useState<number>(bill?.service_value ?? 0);
  const [discountType, setDiscountType] = useState<ModifierType>(bill?.discount_type ?? 'percentage');
  const [discountValue, setDiscountValue] = useState<number>(bill?.discount_value ?? 0);
  const [deliveryFee, setDeliveryFee] = useState<number>(bill?.delivery_fee ?? 0);
  const [adminFee, setAdminFee] = useState<number>(bill?.admin_fee ?? 0);

  const [isSaving, setIsSaving] = useState(false);

  // Entry row for a new item (always at the bottom of the list)
  const [draft, setDraft] = useState<ItemDraft>(emptyDraft);
  const draftNameRef = useRef<HTMLInputElement>(null);
  // Inline edit of an existing item
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemDraft>(emptyDraft);

  // Name suggestions: people from your recent split bills, most frequent first
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: bills } = await supabase
        .from('split_bills').select('id').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(20);
      const ids = (bills ?? []).map(b => b.id);
      if (ids.length === 0) return;
      const { data: rows } = await supabase.from('split_bill_details').select('person_name').in('split_bill_id', ids);
      const count = new Map<string, { name: string; n: number }>();
      for (const r of rows ?? []) {
        const name = (r.person_name ?? '').trim();
        if (!name || name === 'Unknown' || name === 'Unassigned') continue;
        const key = name.toLowerCase();
        const entry = count.get(key) ?? { name, n: 0 };
        entry.n++;
        count.set(key, entry);
      }
      if (!cancelled) setRecentNames([...count.values()].sort((a, b) => b.n - a.n).map(e => e.name).slice(0, 12));
    })();
    return () => { cancelled = true; };
  }, [user]);

  const modifiers: Modifiers = { taxType, taxValue, serviceType, serviceValue, discountType, discountValue, deliveryFee, adminFee };
  const rows = useMemo(() => expandItems(items, people), [items, people]);
  const calculations = useMemo(
    () => calculateSplit(rows, modifiers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, taxType, taxValue, serviceType, serviceValue, discountType, discountValue, deliveryFee, adminFee]
  );

  const pricedItems = items.filter(i => (i.price || 0) * (i.qty || 1) > 0);
  const unassignedItems = pricedItems.filter(i => i.assignees.length === 0);
  const colorOf = (personId: string) => PERSON_COLORS[Math.max(0, people.findIndex(p => p.id === personId)) % PERSON_COLORS.length];
  const personById = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // ── Items ──
  const updateItem = (id: string, patch: Partial<BillItem>) =>
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const draftHasContent = !!draft.name.trim() || draft.price > 0;
  const commitDraft = () => {
    if (!draftHasContent) return;
    if (!draft.price) { toast.error('Enter the price of the item'); return; }
    setItems(prev => [...prev, { id: newId(), name: draft.name.trim(), qty: draft.qty || 1, price: draft.price, assignees: [] }]);
    setDraft(emptyDraft());
    draftNameRef.current?.focus();
  };
  const startEdit = (item: BillItem) => {
    setEditingId(item.id);
    setEditDraft({ name: item.name, qty: item.qty || 1, price: item.price });
  };
  const saveEdit = () => {
    if (!editingId) return;
    if (!editDraft.price) { toast.error('Enter the price of the item'); return; }
    updateItem(editingId, { name: editDraft.name.trim(), qty: editDraft.qty || 1, price: editDraft.price });
    setEditingId(null);
  };
  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setEditingId(current => (current === id ? null : current));
  };

  // ── People ──
  const addPerson = (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    if (people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`${name} is already on the list`);
      return;
    }
    const person = { id: newId(), name };
    setPeople(prev => [...prev, person]);
    setActivePersonId(current => current ?? person.id);
    setNewPersonName('');
  };
  const removePerson = (id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setItems(prev => prev.map(i => ({ ...i, assignees: i.assignees.filter(a => a !== id) })));
    setActivePersonId(current => (current === id ? people.find(p => p.id !== id)?.id ?? null : current));
  };
  const suggestions = recentNames.filter(n => !people.some(p => p.name.toLowerCase() === n.toLowerCase()));

  // ── Assignment ──
  const toggleAssignee = (itemId: string, personId: string) =>
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const has = i.assignees.includes(personId);
      return { ...i, assignees: has ? i.assignees.filter(a => a !== personId) : [...i.assignees, personId] };
    }));
  const assignEveryone = (itemId: string) =>
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const everyone = people.every(p => i.assignees.includes(p.id));
      return { ...i, assignees: everyone ? [] : people.map(p => p.id) };
    }));
  const itemsOf = (personId: string) => pricedItems.filter(i => i.assignees.includes(personId)).length;

  // ── Save ──
  const resetForm = () => {
    setItems([]);
    setDraft(emptyDraft());
    setEditingId(null);
    setPeople([]);
    setActivePersonId(null);
    setTitle('New Split Bill');
    setTaxValue(0); setServiceValue(0); setDiscountValue(0); setDeliveryFee(0); setAdminFee(0);
    setExpandedPeople([]);
  };

  const handleSave = async () => {
    if (!user) return;
    if (editingId) {
      toast.error('Finish editing the item first (press Enter or ✓).');
      return;
    }
    if (draftHasContent) {
      toast.error('Press Enter to add the item you are typing, or clear it.');
      return;
    }
    if (pricedItems.length === 0) {
      toast.error('Add at least one item with a valid price.');
      return;
    }
    if (unassignedItems.length > 0) {
      toast.error(`${unassignedItems.length} item${unassignedItems.length > 1 ? 's are' : ' is'} not assigned to anyone yet.`);
      return;
    }

    setIsSaving(true);
    try {
      const header = {
        title,
        total_subtotal: calculations.totalSubtotal,
        tax_type: taxType,
        tax_value: taxValue,
        service_type: serviceType,
        service_value: serviceValue,
        discount_type: discountType,
        discount_value: discountValue,
        delivery_fee: deliveryFee,
        admin_fee: adminFee,
        grand_total: calculations.targetGrandTotal,
      };

      let billId: string;
      if (isEdit) {
        const { error } = await supabase.from('split_bills').update(header).eq('id', bill.id);
        if (error) throw error;
        billId = bill.id;
        // Replace the old rows
        await supabase.from('split_bill_details').delete().eq('split_bill_id', bill.id);
      } else {
        const { data, error } = await supabase.from('split_bills').insert({ ...header, user_id: user.id }).select().single();
        if (error) throw error;
        billId = data.id;
      }

      const detailPayloads = calculations.calculatedItems.map(item => ({
        split_bill_id: billId,
        person_name: item.personName.trim() || 'Unknown',
        item_name: item.itemName.trim() || 'Item',
        original_price: item.price, // this person's share of the item total
        weight_percentage: item.weightPercentage,
        tax_amount: item.itemTax,
        service_amount: item.itemService,
        discount_amount: item.itemDiscount,
        delivery_amount: item.itemDelivery,
        admin_amount: item.itemAdmin,
        final_price: item.finalPrice,
      }));
      const { error: detailErr } = await supabase.from('split_bill_details').insert(detailPayloads);
      if (detailErr) throw detailErr;

      toast.success(isEdit ? 'Split Bill updated successfully!' : 'Split Bill saved successfully!');
      if (!isEdit) resetForm();
      onClose();
    } catch (err: any) {
      toast.error('Error saving: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const activePerson = activePersonId ? personById.get(activePersonId) : undefined;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <button onClick={onClose} className="mb-4 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} /> Cancel
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Split className="text-primary" size={24} />
            </div>
            <div className="flex flex-col gap-1 w-full max-w-sm">
              <label htmlFor="bill-title" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Bill Title</label>
              <input
                id="bill-title"
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-field border border-border/50 rounded-2xl py-2 px-4 font-bold outline-none focus:ring-2 ring-primary/20 transition-all placeholder:opacity-50"
                placeholder="e.g. Dinner with Friends"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || pricedItems.length === 0}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all font-bold group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} className="group-hover:-translate-y-0.5 transition-transform" />}
          {isSaving ? 'Saving...' : isEdit ? 'Update Bill' : 'Save Split Bill'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* LEFT COLUMN: Editor */}
        <div className="xl:col-span-8 flex flex-col gap-6">

          {/* Items & who had what — one list */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-accent/30 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-sm flex items-center gap-1.5"><Receipt size={14} /> Items & who had what</h3>
                <p className="text-[11px] text-muted-foreground">Type the items from the receipt, add the people, then pick a person and tick what they had.</p>
              </div>
              {unassignedItems.length > 0 && people.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-full shrink-0">
                  <AlertCircle size={12} /> {unassignedItems.length} not assigned
                </span>
              )}
            </div>

            {/* People: pick who you are ticking for, add or remove people */}
            <div className="px-4 py-3 border-b border-border space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {people.map(p => {
                  const active = p.id === activePersonId;
                  return (
                    <span
                      key={p.id}
                      className={`flex items-center rounded-full border transition-colors ${active ? 'border-transparent text-white' : 'border-border bg-card hover:bg-accent/50'}`}
                      style={active ? { backgroundColor: colorOf(p.id) } : undefined}
                    >
                      <button
                        type="button" onClick={() => setActivePersonId(p.id)} aria-pressed={active}
                        className="flex items-center gap-2 pl-1 pr-2 py-1"
                      >
                        <span
                          className={`size-6 rounded-full text-[10px] font-black flex items-center justify-center text-white ${active ? 'bg-white/25' : ''}`}
                          style={active ? undefined : { backgroundColor: colorOf(p.id) }}
                        >
                          {initials(p.name)}
                        </span>
                        <span className="text-sm font-bold">{p.name}</span>
                        <span className={`text-[10px] font-black rounded-full px-1.5 ${active ? 'bg-white/25' : 'bg-accent text-muted-foreground'}`}>{itemsOf(p.id)}</span>
                      </button>
                      <button
                        type="button" onClick={() => removePerson(p.id)} aria-label={`Remove ${p.name}`}
                        className={`pr-2 ${active ? 'text-white/70 hover:text-white' : 'text-muted-foreground hover:text-red-500'}`}
                      >
                        <X size={13} />
                      </button>
                    </span>
                  );
                })}
                <form onSubmit={e => { e.preventDefault(); addPerson(newPersonName); }} className="flex items-center">
                  <div className="relative">
                    <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="text" value={newPersonName} onChange={e => setNewPersonName(e.target.value)}
                      placeholder="Add person" aria-label="New person name"
                      className="w-36 bg-field rounded-full py-1.5 pl-8 pr-3 text-sm font-bold outline-none focus:ring-2 ring-primary/20 placeholder:font-medium placeholder:text-muted-foreground/60"
                    />
                  </div>
                </form>
              </div>

              {suggestions.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mr-1">Recent</span>
                  {suggestions.map(name => (
                    <button
                      key={name} type="button" onClick={() => addPerson(name)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-border text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <PlusCircle size={11} /> {name}
                    </button>
                  ))}
                </div>
              )}

              {activePerson && items.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Tick the items <span className="font-bold" style={{ color: colorOf(activePerson.id) }}>{activePerson.name}</span> had. Items ticked by several people are split equally.
                </p>
              )}
            </div>

            {/* Items */}
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No items yet. Type the first item from the receipt below.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map(item => {
                  const total = (item.price || 0) * (item.qty || 1);

                  if (editingId === item.id) {
                    const onKeys = (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
                      if (e.key === 'Escape') setEditingId(null);
                    };
                    return (
                      <li key={item.id} className="px-4 py-2.5 bg-accent/20">
                        <div className="grid grid-cols-[1fr_56px] sm:grid-cols-[1fr_64px_140px_auto] gap-2 items-center">
                          <input
                            autoFocus type="text" value={editDraft.name} placeholder="Item name"
                            onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} onKeyDown={onKeys}
                            aria-label="Item name"
                            className="min-w-0 bg-card border border-border rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 ring-primary/20"
                          />
                          <input
                            type="text" inputMode="numeric" value={editDraft.qty || ''} placeholder="1"
                            onChange={e => setEditDraft(d => ({ ...d, qty: digitsOnly(e.target.value) }))} onKeyDown={onKeys}
                            onFocus={e => e.target.select()}
                            aria-label="Item quantity"
                            className="w-full bg-card border border-border rounded-lg py-1.5 text-sm text-center font-bold text-primary outline-none focus:ring-2 ring-primary/20 tabular-nums"
                          />
                          <div className="relative col-span-2 sm:col-span-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">Rp</span>
                            <input
                              type="text" inputMode="numeric" value={editDraft.price ? editDraft.price.toLocaleString('id-ID') : ''} placeholder="0"
                              onChange={e => setEditDraft(d => ({ ...d, price: digitsOnly(e.target.value) }))} onKeyDown={onKeys}
                              aria-label="Item price per item"
                              className="w-full bg-card border border-border rounded-lg py-1.5 pl-9 pr-3 text-sm text-right font-medium outline-none focus:ring-2 ring-primary/20 tabular-nums"
                            />
                          </div>
                          <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                            <button type="button" onClick={saveEdit} aria-label="Save item"
                              className="p-1.5 rounded-lg bg-primary text-primary-foreground"><Check size={16} /></button>
                            <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing"
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent"><X size={16} /></button>
                            <button type="button" onClick={() => removeItem(item.id)} aria-label="Delete item"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  const ticked = !!activePersonId && item.assignees.includes(activePersonId);
                  const shared = item.assignees.length;
                  const everyone = people.length > 0 && people.every(p => item.assignees.includes(p.id));
                  return (
                    <li key={item.id} className={`flex items-center gap-3 px-4 py-2 transition-colors ${ticked ? 'bg-primary/5' : shared === 0 && people.length > 0 ? 'bg-amber-500/5' : ''}`}>
                      <button
                        type="button"
                        onClick={() => activePersonId && toggleAssignee(item.id, activePersonId)}
                        disabled={!activePersonId}
                        aria-pressed={ticked}
                        aria-label={activePerson ? `${activePerson.name} had ${item.name || 'this item'}` : `${item.name || 'Item'}`}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left disabled:cursor-default"
                      >
                        {activePersonId && (
                          <span className={`size-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${ticked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                            {ticked && <Check size={13} strokeWidth={3} />}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-bold truncate">{item.name || 'Unnamed item'}</span>
                            <span className="text-sm font-black tabular-nums shrink-0">{formatIDR(total)}</span>
                          </span>
                          <span className="flex items-center gap-1.5 mt-0.5 min-w-0">
                            {item.qty > 1 && (
                              <span className="text-[11px] text-muted-foreground shrink-0">{item.qty} × {formatIDR(item.price)}{people.length > 0 ? ' ·' : ''}</span>
                            )}
                            {people.length === 0 ? null : shared === 0 ? (
                              <span className="text-[11px] font-bold text-amber-600">Not assigned</span>
                            ) : (
                              <>
                                <span className="flex -space-x-1.5 shrink-0">
                                  {item.assignees.slice(0, 5).map(id => (
                                    <span key={id} title={personById.get(id)?.name}
                                      className="size-4 rounded-full ring-2 ring-card text-[7px] font-black text-white flex items-center justify-center"
                                      style={{ backgroundColor: colorOf(id) }}>
                                      {initials(personById.get(id)?.name ?? '')}
                                    </span>
                                  ))}
                                </span>
                                <span className="text-[11px] text-muted-foreground truncate">
                                  {shared === 1 ? personById.get(item.assignees[0])?.name : `shared by ${shared} · ${formatIDR(total / shared)} each`}
                                </span>
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                      {people.length > 1 && (
                        <button
                          type="button" onClick={() => assignEveryone(item.id)}
                          aria-pressed={everyone} aria-label={`Everyone had ${item.name || 'this item'}`} title="Everyone"
                          className={`flex items-center gap-1 text-[10px] font-bold p-1.5 sm:px-2 sm:py-1 rounded-lg shrink-0 transition-colors ${everyone ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
                        >
                          <Users size={14} className="sm:hidden" />
                          <span className="hidden sm:inline">Everyone</span>
                        </button>
                      )}
                      <button
                        type="button" onClick={() => startEdit(item)} aria-label={`Edit ${item.name || 'item'}`} title="Edit item"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* New item entry */}
            <div className="px-4 py-3 border-t border-dashed border-border bg-accent/10 grid grid-cols-[1fr_56px] sm:grid-cols-[1fr_64px_140px_auto] gap-2 items-center">
              <input
                ref={draftNameRef}
                type="text" value={draft.name} placeholder={items.length === 0 ? 'e.g. Iced Americano' : 'Next item'}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); } }}
                aria-label="New item name"
                className="min-w-0 bg-card border border-border rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 ring-primary/20 placeholder:font-medium placeholder:text-muted-foreground/50"
              />
              <input
                type="text" inputMode="numeric" value={draft.qty || ''} placeholder="1"
                onChange={e => setDraft(d => ({ ...d, qty: digitsOnly(e.target.value) }))}
                onFocus={e => e.target.select()}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); } }}
                aria-label="New item quantity"
                className="w-full bg-card border border-border rounded-lg py-1.5 text-sm text-center font-bold text-primary outline-none focus:ring-2 ring-primary/20 tabular-nums"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">Rp</span>
                <input
                  type="text" inputMode="numeric" value={draft.price ? draft.price.toLocaleString('id-ID') : ''} placeholder="Price"
                  onChange={e => setDraft(d => ({ ...d, price: digitsOnly(e.target.value) }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitDraft(); } }}
                  aria-label="New item price per item"
                  className="w-full bg-card border border-border rounded-lg py-1.5 pl-9 pr-3 text-sm text-right font-medium outline-none focus:ring-2 ring-primary/20 tabular-nums placeholder:text-muted-foreground/50"
                />
              </div>
              <button
                type="button" onClick={commitDraft} disabled={!draftHasContent} aria-label="Add item"
                className="h-full flex items-center justify-center gap-1 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40 transition-opacity"
              >
                <PlusCircle size={14} /> <span className="hidden sm:inline">Add</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-accent/20">
              <span className="text-[11px] text-muted-foreground">Press Enter to add an item · <Pencil size={10} className="inline" /> to change or delete one</span>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Subtotal</span>
                <span className="font-black text-primary tabular-nums text-lg">{formatIDR(calculations.totalSubtotal)}</span>
              </div>
            </div>
          </div>

          {/* Global Modifiers */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Calculator size={16} /> Tax, Service & Fees
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <ModifierInput label="Discount" type={discountType} value={discountValue} onTypeChange={setDiscountType} onValueChange={setDiscountValue} colorClass="text-green-500" />
              <ModifierInput label="Tax (PB1)" type={taxType} value={taxValue} onTypeChange={setTaxType} onValueChange={setTaxValue} colorClass="text-rose-500" />
              <ModifierInput label="Service" type={serviceType} value={serviceValue} onTypeChange={setServiceType} onValueChange={setServiceValue} colorClass="text-orange-500" />
              <FeeInput label="Delivery Fee" value={deliveryFee} onChange={setDeliveryFee} />
              <FeeInput label="Admin Fee" value={adminFee} onChange={setAdminFee} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="xl:sticky xl:top-4 flex flex-col gap-6">
            {/* Summary Card */}
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl border border-primary/30 shadow-xl overflow-hidden text-primary-foreground relative">
              <div className="absolute -top-24 -right-24 size-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 size-32 bg-black/20 rounded-full blur-xl pointer-events-none" />
              <div className="p-6 relative z-10 flex flex-col">
                <span className="text-primary-foreground/80 font-bold text-xs uppercase tracking-widest mb-1">Grand Total</span>
                <span className="text-4xl font-black tabular-nums tracking-tighter">{formatIDR(calculations.targetGrandTotal)}</span>
                <div className="h-px w-full bg-white/20 my-6" />
                <div className="flex justify-between items-center mb-3">
                  <span className="text-primary-foreground/80 font-medium text-sm">Subtotal</span>
                  <span className="font-bold tabular-nums">{formatIDR(calculations.totalSubtotal)}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-red-200 font-medium text-sm">Tax & Service</span>
                  <span className="font-bold tabular-nums">+ {formatIDR(calculations.taxNominal + calculations.serviceNominal)}</span>
                </div>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-blue-200 font-medium text-sm">Other Fees</span>
                  <span className="font-bold tabular-nums">+ {formatIDR(deliveryFee + adminFee)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-300 font-medium text-sm">Discount</span>
                  <span className="font-bold tabular-nums text-green-300">- {formatIDR(calculations.discountNominal)}</span>
                </div>
              </div>
            </div>

            {/* Owed per person */}
            <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col">
              <div className="p-4 border-b border-border bg-accent/30 flex justify-between items-center">
                <h3 className="font-bold whitespace-nowrap text-sm uppercase tracking-wider text-muted-foreground">Owed Per Person</h3>
                <Receipt size={16} className="text-muted-foreground" />
              </div>
              <div className="p-2">
                {Object.keys(calculations.subtotalByPerson).length === 0 || calculations.totalSubtotal === 0 ? (
                  <div className="p-6 text-center text-sm font-medium text-muted-foreground/60 italic">
                    Add items and people to see the breakdown.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50">
                    {Object.entries(calculations.subtotalByPerson).map(([person, data]) => {
                      const isExpanded = expandedPeople.includes(person);
                      const personId = people.find(p => p.name === person)?.id;
                      const lines = calculations.calculatedItems.filter(i => (i.personName.trim() || 'Unassigned') === person);
                      const toggleExpand = () =>
                        setExpandedPeople(isExpanded ? expandedPeople.filter(p => p !== person) : [...expandedPeople, person]);
                      return (
                        <li key={person} className="flex flex-col p-2 transition-colors">
                          <button type="button" onClick={toggleExpand} aria-expanded={isExpanded}
                            className="flex justify-between items-center p-2 hover:bg-accent/40 rounded-xl cursor-pointer group text-left">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="size-8 rounded-full text-white flex items-center justify-center font-black text-xs uppercase shadow-sm shrink-0"
                                style={{ backgroundColor: personId ? colorOf(personId) : '#94a3b8' }}>
                                {person === 'Unassigned' ? '?' : initials(person)}
                              </div>
                              <span className={`font-bold text-sm tracking-tight truncate ${person === 'Unassigned' ? 'text-muted-foreground italic' : ''}`}>{person}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black tabular-nums text-primary">{formatIDR(data.total)}</span>
                              {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground group-hover:text-foreground" />}
                            </div>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                <div className="bg-accent/20 rounded-xl p-3 mt-1 ml-11 text-xs border border-border/50 space-y-2">
                                  {lines.map(line => (
                                    <div key={line.id} className="flex justify-between gap-3">
                                      <span className="text-muted-foreground font-medium truncate">{line.itemName || 'Item'}</span>
                                      <span className="font-bold tabular-nums shrink-0">{formatIDR(line.price)}</span>
                                    </div>
                                  ))}
                                  <div className="h-px bg-border/60" />
                                  {data.tax > 0 && (
                                    <div className="flex justify-between text-rose-500">
                                      <span className="font-medium">Tax</span><span className="font-bold tabular-nums">+{formatIDR(data.tax)}</span>
                                    </div>
                                  )}
                                  {data.service > 0 && (
                                    <div className="flex justify-between text-orange-500">
                                      <span className="font-medium">Service</span><span className="font-bold tabular-nums">+{formatIDR(data.service)}</span>
                                    </div>
                                  )}
                                  {data.fees > 0 && (
                                    <div className="flex justify-between text-blue-500">
                                      <span className="font-medium">Other Fees</span><span className="font-bold tabular-nums">+{formatIDR(data.fees)}</span>
                                    </div>
                                  )}
                                  {data.discount > 0 && (
                                    <div className="flex justify-between text-green-500">
                                      <span className="font-medium">Discount</span><span className="font-bold tabular-nums">-{formatIDR(data.discount)}</span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
