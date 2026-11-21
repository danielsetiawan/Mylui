import React, { useState, useEffect } from 'react';
import { DatabaseZap, Save, RefreshCw, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface ParsedLine {
  amount: number;
  category: string;
  details: { name: string; amount: number }[];
  raw: string;
}

/**
 * Parses user shorthand like:
 *   "53k spotinet"                       → amount=53000, category="spotinet", no details
 *   "600k shopipai(bayar wifi 291k, 26 terigu eskrim, 14k minyak)"
 *     → amount=600000, category="shopipai", details=[{name:"bayar wifi",amount:291000},{name:"terigu eskrim",amount:26000},{name:"minyak",amount:14000}]
 *   "12k kue morin (44k kue - 32k koin game pik)"
 *     → amount=12000, category="kue morin", details=[{name:"kue",amount:44000},{name:"koin game pik",amount:-32000}]
 */
function parseLines(text: string): ParsedLine[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: ParsedLine[] = [];

  for (const raw of lines) {
    try {
      // Match main amount (e.g. "53k" or "1500k")
      const mainMatch = raw.match(/^(\d+)k\s+/i);
      if (!mainMatch) continue;

      const amount = parseInt(mainMatch[1]) * 1000;
      const rest = raw.slice(mainMatch[0].length);

      // Check for parentheses (details)
      const parenMatch = rest.match(/^(.+?)\s*\((.+)\)\s*$/);

      if (parenMatch) {
        const category = parenMatch[1].trim();
        const detailsRaw = parenMatch[2].trim();

        // Split details by comma
        const detailParts = detailsRaw.split(',').map(d => d.trim()).filter(Boolean);
        const details: { name: string; amount: number }[] = [];

        for (const part of detailParts) {
          // Handle subtraction pattern: "44k kue - 32k koin game pik"
          // Split by " - " for subtraction items
          const subParts = part.split(/\s+-\s+/);

          for (let i = 0; i < subParts.length; i++) {
            const sp = subParts[i].trim();
            const detailMatch = sp.match(/^(\d+)k?\s+(.+)/i);
            if (detailMatch) {
              const detailAmt = parseInt(detailMatch[1]) * 1000;
              const detailName = detailMatch[2].trim();
              // First item is positive, subtracted items are negative
              details.push({
                name: detailName,
                amount: i === 0 ? detailAmt : -detailAmt
              });
            } else {
              // No amount prefix, skip or treat as name only
              details.push({ name: sp, amount: 0 });
            }
          }
        }

        results.push({ amount, category, details, raw });
      } else {
        results.push({ amount, category: rest.trim(), details: [], raw });
      }
    } catch {
      // Skip unparseable lines
      continue;
    }
  }

  return results;
}

export function Init() {
  const { user, profile } = useAuth();
  const now = new Date();
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [textInput, setTextInput] = useState('');
  const [parsed, setParsed] = useState<ParsedLine[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate year options: 5 years back up to current
  const YEARS = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 6 + i);

  // Guard: only admin
  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
        <AlertTriangle size={48} className="opacity-30" />
        <p className="font-bold text-lg">Access Denied</p>
        <p className="text-sm">You do not have admin privileges to access this page.</p>
      </div>
    );
  }

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email');
      if (data) setUsers(data as any[]);
    };
    fetchUsers();
  }, []);

  const handleParse = () => {
    const result = parseLines(textInput);
    setParsed(result);
    if (result.length === 0 && textInput.trim()) {
      toast.error('No valid lines found. Make sure format is: "53k spotinet"');
    } else {
      toast.success(`Parsed ${result.length} transactions`);
    }
  };

  const handleSave = async () => {
    if (!selectedUserId) {
      toast.error('Please select a user');
      return;
    }
    if (parsed.length === 0) {
      toast.error('No parsed data to save. Click Preview first.');
      return;
    }

    // Build date string: use 1st of selected month as default
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;

    setIsSaving(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const item of parsed) {
        // Insert transaction header
        const { data: txData, error: txErr } = await supabase
          .from('transactions')
          .insert({
            user_id: selectedUserId,
            type: 'expense',
            amount: item.amount,
            category: item.category,
            description: item.raw,
            date: dateStr
          })
          .select()
          .single();

        if (txErr) {
          errorCount++;
          continue;
        }

        // Insert details if any
        if (item.details.length > 0 && txData) {
          const detailPayloads = item.details.map(d => ({
            transaction_id: txData.id,
            name: d.name,
            amount: d.amount
          }));

          const { error: detailErr } = await supabase
            .from('transaction_details')
            .insert(detailPayloads);

          if (detailErr) {
            console.error('Detail insert error:', detailErr);
          }
        }

        successCount++;
      }

      if (errorCount > 0) {
        toast.warning(`${successCount} saved, ${errorCount} failed`);
      } else {
        toast.success(`All ${successCount} transactions saved successfully!`);
        setTextInput('');
        setParsed([]);
      }
    } catch (err: any) {
      toast.error('Unexpected error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const formatIDR = (num: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Math.round(num));

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            <DatabaseZap className="text-amber-500" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Init Data</h1>
            <p className="text-sm font-bold text-muted-foreground mt-1 uppercase tracking-widest">Admin Bulk Import Tool</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 sm:p-6 flex flex-col gap-5">

        {/* User Select */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Select User</label>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full bg-accent/50 border border-border/50 rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
            >
              <option value="">-- Choose User --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Transaction Month & Year</label>
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="flex-1 bg-accent/50 border border-border/50 rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="w-32 bg-accent/50 border border-border/50 rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
              >
                {YEARS.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Textarea */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Paste Raw Data</label>
          <textarea
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder={`53k spotinet\n192k token\n600k shopipai(bayar wifi 291k, 26 terigu eskrim, 14k minyak)\n1100k shopipai(855k sepatu & sandal adidas, 26k insole, 74k pop corn + cocacola)`}
            rows={10}
            className="w-full bg-accent/50 border border-border/50 rounded-2xl py-3 px-4 font-mono text-sm outline-none focus:ring-2 ring-primary/20 resize-y leading-relaxed"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleParse}
            disabled={!textInput.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle size={18} /> Preview & Parse
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || parsed.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-lg shadow-primary/20 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            {isSaving ? 'Saving...' : `Save ${parsed.length} Transactions`}
          </button>
        </div>
      </div>

      {/* Preview Table */}
      {parsed.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-accent/30">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
              Preview: {parsed.length} Transactions
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-12">#</th>
                  <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase">Category</th>
                  <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase text-right">Amount</th>
                  <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase">Details</th>
                  <th className="px-4 py-3 font-black text-xs text-muted-foreground uppercase w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.map((item, i) => (
                  <tr key={i} className="group hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-muted-foreground/50">{i + 1}</td>
                    <td className="px-4 py-3 font-bold">{item.category}</td>
                    <td className="px-4 py-3 font-black text-right tabular-nums text-primary">{formatIDR(item.amount)}</td>
                    <td className="px-4 py-3">
                      {item.details.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.details.map((d, j) => (
                            <span
                              key={j}
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${d.amount < 0
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : 'bg-primary/10 text-primary border-primary/20'
                                }`}
                            >
                              {d.name}: {formatIDR(d.amount)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/50 italic">No details</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setParsed(parsed.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-muted-foreground/50 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-accent/30 border-t border-border">
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-sm text-muted-foreground uppercase">Grand Total</td>
                  <td className="px-4 py-3 text-right font-black text-primary tabular-nums text-lg">
                    {formatIDR(parsed.reduce((sum, item) => sum + item.amount, 0))}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
