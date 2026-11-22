import React, { useMemo, useState } from 'react';
import { Plus, X, Check, Loader2 } from 'lucide-react';
import { getCategoryIcon } from '../lib/categoryIcons';

interface Option {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

interface ChipSelectProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  onAdd: (name: string) => Promise<Option | null>;
  /** Option ids, most used first; those come first. Others keep their original order. */
  order?: string[];
  /** How many chips to show before "+N more" (the selected one is always shown) */
  maxVisible?: number;
  /** Clicking the selected chip clears it */
  allowDeselect?: boolean;
  /** Small text next to the label, e.g. "guessed from description" */
  hint?: string;
}

/**
 * One-click picker: every option is a chip (colour + icon), most used first.
 * Replaces the dropdown + search for wallets and categories in the transaction forms.
 * "+" adds a new option inline.
 */
export function ChipSelect({
  label, value, options, onChange, onAdd, order = [], maxVisible = 8, allowDeselect, hint,
}: ChipSelectProps) {
  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    const rank = new Map(order.map((id, i) => [id, i]));
    return options
      .map((o, i) => ({ o, i }))
      .sort((a, b) => (rank.get(a.o.id) ?? 1e6 + a.i) - (rank.get(b.o.id) ?? 1e6 + b.i))
      .map(x => x.o);
  }, [options, order]);

  let visible = expanded ? sorted : sorted.slice(0, maxVisible);
  const selected = sorted.find(o => o.id === value);
  if (selected && !visible.includes(selected)) visible = [...visible, selected];
  const hiddenCount = sorted.length - visible.length;

  const handleSave = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const created = await onAdd(newName.trim());
    setSaving(false);
    if (created) {
      onChange(created.id);
      setNewName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        {hint && <span className="text-[10px] font-medium text-primary">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {visible.map(o => {
          const active = o.id === value;
          const Icon = o.icon ? getCategoryIcon(o.icon) : null;
          const color = o.color || '#64748b';
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(active && allowDeselect ? '' : o.id)}
              className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                active ? 'text-white border-transparent shadow-sm' : 'bg-card border-border text-foreground hover:bg-accent/60'
              }`}
              style={active ? { backgroundColor: color } : undefined}
            >
              <span
                className="size-5 rounded-md flex items-center justify-center shrink-0"
                style={active ? { backgroundColor: 'rgba(255,255,255,0.22)' } : { backgroundColor: color + '22', color }}
              >
                {Icon ? <Icon size={12} /> : <span className="size-2 rounded-full" style={{ backgroundColor: active ? '#fff' : color }} />}
              </span>
              {o.name}
            </button>
          );
        })}

        {hiddenCount > 0 && (
          <button type="button" onClick={() => setExpanded(true)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-muted-foreground border border-dashed border-border hover:bg-accent/60">
            +{hiddenCount} more
          </button>
        )}
        {expanded && sorted.length > maxVisible && (
          <button type="button" onClick={() => setExpanded(false)}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:bg-accent/60">
            Show less
          </button>
        )}

        {isAdding ? (
          <span className="flex items-center gap-1">
            <input
              type="text" autoFocus value={newName} placeholder="New name..."
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
              }}
              aria-label={`New ${label.toLowerCase()} name`}
              className="w-32 bg-accent/50 border border-primary/30 rounded-xl py-1.5 px-2.5 text-xs font-bold outline-none focus:ring-2 ring-primary/20"
            />
            <button type="button" onClick={handleSave} disabled={saving || !newName.trim()} aria-label="Save"
              className="p-1.5 bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button type="button" onClick={() => { setIsAdding(false); setNewName(''); }} aria-label="Cancel"
              className="p-1.5 bg-accent text-muted-foreground rounded-lg">
              <X size={14} />
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setIsAdding(true)} title={`Add ${label.toLowerCase()}`} aria-label={`Add ${label.toLowerCase()}`}
            className="p-1.5 rounded-xl text-primary border border-dashed border-primary/30 hover:bg-primary/10 transition-colors">
            <Plus size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
