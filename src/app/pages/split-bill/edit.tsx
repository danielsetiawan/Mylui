import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { SplitBillForm } from './SplitBillForm';
import { BillItem, BillPerson, groupRows } from './calculate';

/**
 * Route /split-bill/:id — edit an existing split bill.
 * Loads the header and its saved rows from the database (so a page refresh keeps
 * you here), turns the rows back into items and people (see groupRows), then
 * shows the same editor as a new bill.
 */
export function SplitBillEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<{ bill: any; items: BillItem[]; people: BillPerson[] } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [header, details] = await Promise.all([
        supabase.from('split_bills').select('*').eq('id', id).maybeSingle(),
        supabase.from('split_bill_details').select('*').eq('split_bill_id', id),
      ]);
      if (cancelled) return;
      if (header.error || !header.data) {
        toast.error(header.error ? 'Failed to load bill: ' + header.error.message : 'Split bill not found');
        navigate('/split-bill', { replace: true });
        return;
      }
      if (details.error) toast.error('Failed to load bill items: ' + details.error.message);
      setLoaded({ bill: header.data, ...groupRows(details.data ?? [], () => crypto.randomUUID()) });
    })();
    return () => { cancelled = true; };
  }, [id, navigate]);

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2 text-sm font-bold">
        <RefreshCw size={16} className="animate-spin" /> Loading bill...
      </div>
    );
  }

  return (
    <SplitBillForm
      key={loaded.bill.id}
      bill={loaded.bill}
      initialItems={loaded.items}
      initialPeople={loaded.people}
      onClose={() => navigate('/split-bill')}
    />
  );
}
