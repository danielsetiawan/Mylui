import React, { useState } from 'react';
import { Plus, X, Check, Loader2 } from 'lucide-react';

interface Option {
  id: string;
  name: string;
  color?: string;
  icon?: string;
}

interface QuickSelectWithAddProps {
  label: string;
  value: string;
  options: Option[];
  onChange: (id: string) => void;
  onAdd: (name: string) => Promise<Option | null>;
  placeholder?: string;
  required?: boolean;
}

/**
 * Dropdown selector with inline "Add New" capability.
 * Clicking "+ Tambah Baru" expands a small input to create a new option without leaving the page.
 */
export function QuickSelectWithAdd({
  label, value, options, onChange, onAdd, placeholder = 'Pilih...', required
}: QuickSelectWithAddProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

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
      <label className="text-xs font-bold text-muted-foreground">{label}</label>

      {isAdding ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } if (e.key === 'Escape') { setIsAdding(false); setNewName(''); } }}
            placeholder="Nama baru..."
            className="flex-1 bg-accent/50 border border-primary/30 rounded-xl py-2.5 px-3 text-sm font-bold outline-none focus:ring-2 ring-primary/20"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !newName.trim()}
            className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button
            type="button"
            onClick={() => { setIsAdding(false); setNewName(''); }}
            className="p-2.5 bg-accent text-muted-foreground rounded-xl hover:bg-accent/80 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            required={required}
            className="flex-1 bg-accent/50 border-none rounded-2xl py-3 px-4 font-bold outline-none focus:ring-2 ring-primary/20 appearance-none"
          >
            <option value="">{placeholder}</option>
            {options.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            title="Tambah baru"
            className="shrink-0 p-2.5 bg-accent hover:bg-primary/10 text-primary rounded-xl transition-colors border border-dashed border-primary/30"
          >
            <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
