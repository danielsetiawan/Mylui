import React, { useState, useMemo, useEffect } from 'react';
import { Split, PlusCircle, Trash2, Save, RefreshCw, Calculator, DollarSign, Percent, ChevronDown, ChevronUp, Receipt, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

type ModifierType = 'percentage' | 'nominal';

interface SplitItem {
  id: string; // temp id for UI
  personName: string;
  itemName: string;
  originalPrice: number;
  qty: number;
}

// Custom input for % / Rp toggles
const ModifierInput = ({ 
  label, 
  type, 
  value, 
  onTypeChange, 
  onValueChange, 
  colorClass 
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
          onClick={() => { onTypeChange('percentage'); onValueChange(0); }}
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${type === 'percentage' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <Percent size={12} className="inline mr-1" /> %
        </button>
        <button 
          onClick={() => { onTypeChange('nominal'); onValueChange(0); }}
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors ${type === 'nominal' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
        >
          <DollarSign size={12} className="inline mr-1" /> Rp
        </button>
      </div>
    </div>
    <div className="relative mt-1">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <span className={`text-sm font-bold ${colorClass}`}>
          {type === 'percentage' ? '%' : 'Rp'}
        </span>
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value || ''}
        onChange={(e) => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          onValueChange(Number(val));
        }}
        placeholder="0"
        className="w-full bg-accent/30 border-none rounded-lg pl-9 pr-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 tabular-nums"
      />
    </div>
  </div>
);

export function SplitBillEdit({ bill, onClose }: { bill: any; onClose: () => void }) {
  const { user } = useAuth();
  
  // Header state
  const [title, setTitle] = useState(bill.title);
  
  // Items state
  const [items, setItems] = useState<SplitItem[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(true);

  // Breakdown Expand State (Allow multiple)
  const [expandedPeople, setExpandedPeople] = useState<string[]>([]);

  // Global modifiers
  const [taxType, setTaxType] = useState<ModifierType>(bill.tax_type);
  const [taxValue, setTaxValue] = useState<number>(bill.tax_value);
  
  const [serviceType, setServiceType] = useState<ModifierType>(bill.service_type);
  const [serviceValue, setServiceValue] = useState<number>(bill.service_value);
  
  const [discountType, setDiscountType] = useState<ModifierType>(bill.discount_type);
  const [discountValue, setDiscountValue] = useState<number>(bill.discount_value);
  
  const [deliveryFee, setDeliveryFee] = useState<number>(bill.delivery_fee);
  const [adminFee, setAdminFee] = useState<number>(bill.admin_fee);

  useEffect(() => {
    const fetchDetails = async () => {
      const { data, error } = await supabase
        .from('split_bill_details')
        .select('*')
        .eq('split_bill_id', bill.id);
        
      if (!error && data) {
        setItems(data.map(d => ({
          id: d.id,
          personName: d.person_name,
          itemName: d.item_name,
          originalPrice: d.original_price, // the stored original_price in Details was total base. But since we don't have qty in DB, let's treat qty as 1 and originalPrice as original_price
          qty: 1
        })));
      }
      setIsLoadingDetails(false);
    };
    if (bill && bill.id) {
      fetchDetails();
    }
  }, [bill]);

  const [isSaving, setIsSaving] = useState(false);

  // Calculations
  const calculations = useMemo(() => {
    // 1. Subtotal (including Qty)
    const totalSubtotal = items.reduce((sum, item) => sum + ((item.originalPrice || 0) * (item.qty || 1)), 0);
    
    // 2. Global Nominals
    const taxNominal = taxType === 'percentage' ? totalSubtotal * (taxValue / 100) : taxValue;
    const serviceNominal = serviceType === 'percentage' ? totalSubtotal * (serviceValue / 100) : serviceValue;
    const discountNominal = discountType === 'percentage' ? totalSubtotal * (discountValue / 100) : discountValue;
    
    // Exact floating grand total
    const exactGrandTotal = totalSubtotal + taxNominal + serviceNominal + deliveryFee + adminFee - discountNominal;
    const targetGrandTotal = Math.round(exactGrandTotal);

    // 3. Proportioning Items (Rounding gap eliminated as requested)
    const calculatedItems = items.map(item => {
      const price = (item.originalPrice || 0) * (item.qty || 1);
      const ratio = totalSubtotal > 0 ? price / totalSubtotal : 0;
      
      const itemTax = ratio * taxNominal;
      const itemService = ratio * serviceNominal;
      const itemDiscount = ratio * discountNominal;
      const itemDelivery = ratio * deliveryFee;
      const itemAdmin = ratio * adminFee;
      
      const exactTotal = price + itemTax + itemService + itemDelivery + itemAdmin - itemDiscount;
      const finalPrice = Math.round(exactTotal);
      
      return {
        ...item,
        weightPercentage: ratio * 100,
        itemTax,
        itemService,
        itemDiscount,
        itemDelivery,
        itemAdmin,
        finalPrice,
        price
      };
    });

    // Secondary table: Group by Person with full breakdown
    const subtotalByPerson: Record<string, { total: number; base: number; tax: number; service: number; fees: number; discount: number; }> = {};
    calculatedItems.forEach(item => {
      const p = item.personName.trim() || 'Unassigned';
      if (!subtotalByPerson[p]) subtotalByPerson[p] = { total: 0, base: 0, tax: 0, service: 0, fees: 0, discount: 0 };
      subtotalByPerson[p].total += item.finalPrice;
      subtotalByPerson[p].base += item.price;
      subtotalByPerson[p].tax += item.itemTax;
      subtotalByPerson[p].service += item.itemService;
      subtotalByPerson[p].fees += item.itemDelivery + item.itemAdmin;
      subtotalByPerson[p].discount += item.itemDiscount;
    });

    return {
      totalSubtotal,
      taxNominal,
      serviceNominal,
      discountNominal,
      targetGrandTotal,
      calculatedItems,
      subtotalByPerson
    };
  }, [items, taxType, taxValue, serviceType, serviceValue, discountType, discountValue, deliveryFee, adminFee]);

  const handleSave = async () => {
    if (!user) return;
    
    const validItems = calculations.calculatedItems.filter(i => i.originalPrice > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one item with a valid price.');
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Update header
      const { error: headerErr } = await supabase
        .from('split_bills')
        .update({
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
          grand_total: calculations.targetGrandTotal
        })
        .eq('id', bill.id);
        
      if (headerErr) throw headerErr;

      // 2. Delete old items
      await supabase.from('split_bill_details').delete().eq('split_bill_id', bill.id);

      // 3. Insert new items
      const detailPayloads = validItems.map(item => ({
        split_bill_id: bill.id,
        person_name: item.personName.trim() || 'Unknown',
        item_name: item.itemName.trim() || 'Item',
        original_price: item.price, // Storing total base price for item
        weight_percentage: item.weightPercentage,
        tax_amount: item.itemTax,
        service_amount: item.itemService,
        discount_amount: item.itemDiscount,
        delivery_amount: item.itemDelivery,
        admin_amount: item.itemAdmin,
        final_price: item.finalPrice
      }));

      const { error: detailErr } = await supabase
        .from('split_bill_details')
        .insert(detailPayloads);
        
      if (detailErr) throw detailErr;

      toast.success('Split Bill updated successfully!');
      onClose();
      
    } catch (err: any) {
      toast.error('Error saving: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const addItemRow = () => {
    setItems([...items, { id: crypto.randomUUID(), personName: '', itemName: '', originalPrice: 0, qty: 1 }]);
  };

  const removeItemRow = (id: string) => {
    if (items.length === 1) {
      setItems([{ id: crypto.randomUUID(), personName: '', itemName: '', originalPrice: 0, qty: 1 }]);
    } else {
      setItems(items.filter(i => i.id !== id));
    }
  };

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(num));
  };
  
  if (isLoadingDetails) {
    return <div className="flex justify-center items-center py-20"><RefreshCw className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button onClick={onClose} className="mb-4 flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} /> Cancel
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
              <Split className="text-primary" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="bg-transparent border-none outline-none ring-0 w-full placeholder:text-muted-foreground/50 transition-all focus:bg-accent/50 focus:rounded-lg focus:px-2 -ml-2 py-1"
                  placeholder="Trip to Bali..."
                />
              </h1>
              <p className="text-sm font-bold text-muted-foreground mt-1 uppercase tracking-widest">Fairly divide your bills</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || items.every(i => i.originalPrice === 0)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 active:bg-primary/80 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 transition-all font-bold group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} className="group-hover:-translate-y-0.5 transition-transform" />}
          {isSaving ? 'Saving...' : 'Update Bill'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Editor */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Table Area */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border bg-accent/30 flex justify-between items-center">
              <h3 className="font-bold whitespace-nowrap text-sm uppercase tracking-wider text-muted-foreground">Line Items</h3>
              <button 
                onClick={addItemRow}
                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <PlusCircle size={14} /> Add Row
              </button>
            </div>
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-12">#</th>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-[20%]">Person</th>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-[35%]">Item Description</th>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-16 text-center">Qty</th>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-32 text-right">Price/Item</th>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-32 text-right bg-accent/20">Total</th>
                    <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AnimatePresence initial={false}>
                    {items.map((item, index) => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="group hover:bg-accent/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-xs font-bold text-muted-foreground/50">{index + 1}</td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            placeholder="e.g. Antony"
                            value={item.personName}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[index].personName = e.target.value;
                              setItems(newItems);
                            }}
                            className="w-full bg-transparent border-none border-b border-dashed border-transparent focus:border-border rounded-none px-0 py-1.5 font-bold outline-none ring-0 placeholder:text-muted-foreground/40"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            placeholder="e.g. Americano"
                            value={item.itemName}
                            onChange={(e) => {
                              const newItems = [...items];
                              newItems[index].itemName = e.target.value;
                              setItems(newItems);
                            }}
                            className="w-full bg-transparent border-none border-b border-dashed border-transparent focus:border-border rounded-none px-0 py-1.5 font-medium outline-none ring-0 placeholder:text-muted-foreground/40"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="1"
                            value={item.qty || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              const newItems = [...items];
                              newItems[index].qty = Number(val);
                              setItems(newItems);
                            }}
                            className="w-full bg-transparent border-none border-b border-dashed border-transparent focus:border-border rounded-none px-0 py-1.5 font-bold text-center outline-none ring-0 tabular-nums placeholder:text-muted-foreground/40 text-primary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="text" 
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={item.originalPrice || ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '');
                              const newItems = [...items];
                              newItems[index].originalPrice = Number(val);
                              setItems(newItems);
                            }}
                            className="w-full bg-transparent border-none border-b border-dashed border-transparent focus:border-border rounded-none px-0 py-1.5 font-medium text-right outline-none ring-0 tabular-nums placeholder:text-muted-foreground/40"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-black tabular-nums bg-accent/10">
                          {formatIDR((item.originalPrice || 0) * (item.qty || 1))}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button 
                            onClick={() => removeItemRow(item.id)}
                            className="p-1.5 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
                <tfoot>
                  <tr className="bg-accent/30 border-t border-border">
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-sm text-muted-foreground uppercase">Total Subtotal</td>
                    <td className="px-4 py-3 text-right font-black text-primary tabular-nums text-lg">{formatIDR(calculations.totalSubtotal)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {items.length === 0 && (
              <div onClick={addItemRow} className="p-8 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer hover:bg-accent/50 transition-colors border-t border-dashed border-border/50">
                <PlusCircle size={32} className="mb-2 opacity-50" />
                <p className="font-bold text-sm">Add First Item</p>
              </div>
            )}
          </div>

          {/* Global Modifiers */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
              <Calculator size={16} /> Global Bill Modifiers
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <ModifierInput 
                label="Discount" type={discountType} value={discountValue} 
                onTypeChange={setDiscountType} onValueChange={setDiscountValue} colorClass="text-green-500" 
              />
              <ModifierInput 
                label="Tax (PB1)" type={taxType} value={taxValue} 
                onTypeChange={setTaxType} onValueChange={setTaxValue} colorClass="text-rose-500" 
              />
              <ModifierInput 
                label="Service" type={serviceType} value={serviceValue} 
                onTypeChange={setServiceType} onValueChange={setServiceValue} colorClass="text-orange-500" 
              />
              
              <div className="flex flex-col gap-1.5 p-3 sm:p-4 rounded-xl border border-border bg-card">
                <span className="text-xs font-bold text-muted-foreground uppercase">Delivery Fee</span>
                <div className="relative mt-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-bold text-blue-500">Rp</span>
                  </div>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" value={deliveryFee || ''} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setDeliveryFee(Number(val));
                    }} 
                    placeholder="0"
                    className="w-full bg-accent/30 border-none rounded-lg pl-9 pr-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 tabular-nums"
                  />
                </div>
              </div>
              
              <div className="flex flex-col gap-1.5 p-3 sm:p-4 rounded-xl border border-border bg-card">
                <span className="text-xs font-bold text-muted-foreground uppercase">Admin Fee</span>
                <div className="relative mt-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-sm font-bold text-blue-500">Rp</span>
                  </div>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" value={adminFee || ''} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setAdminFee(Number(val));
                    }} 
                    placeholder="0"
                    className="w-full bg-accent/30 border-none rounded-lg pl-9 pr-3 py-2 text-sm font-bold outline-none focus:ring-2 ring-primary/20 tabular-nums"
                  />
                </div>
              </div>

            </div>
          </div>
          
        </div>

        {/* RIGHT COLUMN: Results */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          
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
          
          {/* Debt Breakdown by Person */}
          <div className="bg-card rounded-2xl border border-border shadow-sm flex flex-col">
            <div className="p-4 border-b border-border bg-accent/30 flex justify-between items-center">
              <h3 className="font-bold whitespace-nowrap text-sm uppercase tracking-wider text-muted-foreground">Owed Per Person</h3>
              <Receipt size={16} className="text-muted-foreground" />
            </div>
            <div className="p-2">
              {Object.keys(calculations.subtotalByPerson).length === 0 || calculations.totalSubtotal === 0 ? (
                <div className="p-6 text-center text-sm font-medium text-muted-foreground/60 italic">
                  Add items and names to see the breakdown.
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {Object.entries(calculations.subtotalByPerson).map(([person, data]) => {
                    const isExpanded = expandedPeople.includes(person);
                    
                    const toggleExpand = () => {
                      if (isExpanded) {
                        setExpandedPeople(expandedPeople.filter(p => p !== person));
                      } else {
                        setExpandedPeople([...expandedPeople, person]);
                      }
                    };
                    
                    return (
                      <li key={person} className="flex flex-col p-2 transition-colors">
                        {/* Main Row */}
                        <div 
                          onClick={toggleExpand}
                          className="flex justify-between items-center p-2 hover:bg-accent/40 rounded-xl cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs uppercase shadow-sm">
                              {person === 'Unassigned' ? '?' : person.substring(0, 2)}
                            </div>
                            <span className={`font-bold text-sm tracking-tight ${person === 'Unassigned' ? 'text-muted-foreground italic' : ''}`}>{person}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-black tabular-nums text-primary">{formatIDR(data.total)}</span>
                            {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground group-hover:text-foreground" />}
                          </div>
                        </div>

                        {/* Breakdown Expansion */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-accent/20 rounded-xl p-3 mt-1 ml-11 text-xs border border-border/50 space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground font-medium">Base Menus</span>
                                  <span className="font-bold tabular-nums">{formatIDR(data.base)}</span>
                                </div>
                                {data.tax > 0 && (
                                  <div className="flex justify-between text-rose-500">
                                    <span className="font-medium">Tax Allocation</span>
                                    <span className="font-bold tabular-nums">+{formatIDR(data.tax)}</span>
                                  </div>
                                )}
                                {data.service > 0 && (
                                  <div className="flex justify-between text-orange-500">
                                    <span className="font-medium">Service Allocation</span>
                                    <span className="font-bold tabular-nums">+{formatIDR(data.service)}</span>
                                  </div>
                                )}
                                {data.fees > 0 && (
                                  <div className="flex justify-between text-blue-500">
                                    <span className="font-medium">Other Fees</span>
                                    <span className="font-bold tabular-nums">+{formatIDR(data.fees)}</span>
                                  </div>
                                )}
                                {data.discount > 0 && (
                                  <div className="flex justify-between text-green-500">
                                    <span className="font-medium">Discount</span>
                                    <span className="font-bold tabular-nums">-{formatIDR(data.discount)}</span>
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
  );
}
