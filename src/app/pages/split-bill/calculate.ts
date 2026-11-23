/**
 * Split bill: data shapes and the calculation.
 *
 * The UI works with ITEMS (one line of the receipt, possibly shared by several
 * people). The database (`split_bill_details`) and the calculation work with
 * ROWS: one row per (person, item share). `expandItems` turns items into rows,
 * `groupRows` turns saved rows back into items for editing.
 *
 * `calculateSplit` is the split formula. It is a CONTRACT shared with the
 * mobile app (mylui-mobile/lib/core/split_calc.dart): results must
 * stay identical. It was moved here unchanged from the old add.tsx / edit.tsx.
 */

export type ModifierType = 'percentage' | 'nominal';

/** One line of the receipt as edited in the UI */
export interface BillItem {
  id: string;
  name: string;
  qty: number;
  price: number;        // price per unit
  assignees: string[];  // person ids; several = shared equally
}

export interface BillPerson {
  id: string;
  name: string;
}

/** One (person, item share) row — the shape stored in split_bill_details */
export interface SplitRow {
  id: string;
  personName: string;
  itemName: string;
  originalPrice: number;
  qty: number;
}

export interface Modifiers {
  taxType: ModifierType;
  taxValue: number;
  serviceType: ModifierType;
  serviceValue: number;
  discountType: ModifierType;
  discountValue: number;
  deliveryFee: number;
  adminFee: number;
}

/**
 * Split a whole-rupiah amount into `n` whole-rupiah shares that add up exactly
 * to the amount. The first `remainder` shares get 1 rupiah more.
 */
export function splitEvenly(amount: number, n: number): number[] {
  if (n <= 0) return [];
  const total = Math.round(amount);
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Items → rows. Items without a price are skipped; items without people get one 'Unassigned' row. */
export function expandItems(items: BillItem[], people: BillPerson[]): SplitRow[] {
  const nameOf = new Map(people.map(p => [p.id, p.name]));
  const rows: SplitRow[] = [];
  for (const item of items) {
    const total = (item.price || 0) * (item.qty || 1);
    if (total <= 0) continue;
    const names = item.assignees.map(id => nameOf.get(id)).filter((n): n is string => !!n);
    if (names.length === 0) {
      rows.push({ id: `${item.id}:-`, personName: '', itemName: item.name, originalPrice: total, qty: 1 });
      continue;
    }
    splitEvenly(total, names.length).forEach((share, i) => {
      rows.push({ id: `${item.id}:${i}`, personName: names[i], itemName: item.name, originalPrice: share, qty: 1 });
    });
  }
  return rows;
}

/**
 * Saved rows → items for editing. Rows with the same item name and (almost)
 * the same price — at most 1 rupiah apart, the rounding of a shared item — for
 * different people are merged back into one shared item, so re-saving gives the
 * same amounts. Anything else stays its own item. Quantity is not stored, so
 * every item comes back as qty 1 with its total as the price.
 */
export function groupRows(
  rows: { person_name: string; item_name: string; original_price: number }[],
  newId: () => string
): { items: BillItem[]; people: BillPerson[] } {
  const people: BillPerson[] = [];
  const personId = new Map<string, string>();
  const idFor = (name: string) => {
    const key = name.trim().toLowerCase();
    if (!personId.has(key)) {
      const id = newId();
      personId.set(key, id);
      people.push({ id, name: name.trim() });
    }
    return personId.get(key)!;
  };

  const groups: { name: string; shares: number[]; assignees: string[] }[] = [];
  for (const row of rows) {
    const share = Number(row.original_price) || 0;
    const person = row.person_name?.trim();
    const pid = person && person !== 'Unknown' ? idFor(person) : null;
    const group = groups.find(g =>
      g.name === row.item_name &&
      pid !== null && !g.assignees.includes(pid) && g.assignees.length > 0 &&
      Math.abs(g.shares[0] - share) <= 1 && Math.abs(g.shares[g.shares.length - 1] - share) <= 1
    );
    if (group) {
      group.shares.push(share);
      group.assignees.push(pid!);
    } else {
      groups.push({ name: row.item_name, shares: [share], assignees: pid ? [pid] : [] });
    }
  }

  const items = groups.map(g => {
    // Keep the bigger shares first so splitEvenly gives the same amounts back
    const total = g.shares.reduce((a, b) => a + b, 0);
    const order = g.assignees
      .map((id, i) => ({ id, share: g.shares[i] }))
      .sort((a, b) => b.share - a.share)
      .map(x => x.id);
    return { id: newId(), name: g.name, qty: 1, price: total, assignees: order };
  });
  return { items, people };
}

/** The split formula (unchanged). Rows without a person are counted as 'Unassigned'. */
export function calculateSplit(items: SplitRow[], m: Modifiers) {
  const { taxType, taxValue, serviceType, serviceValue, discountType, discountValue, deliveryFee, adminFee } = m;

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
  const uniquePeopleMap = new Map<string, number>();
  items.forEach(i => {
    const p = i.personName.trim() || 'Unassigned';
    uniquePeopleMap.set(p, (uniquePeopleMap.get(p) || 0) + 1);
  });

  const numPeople = uniquePeopleMap.size || 1;
  const adminPerPerson = adminFee / numPeople;
  const deliveryPerPerson = deliveryFee / numPeople;

  const calculatedItems = items.map(item => {
    const price = (item.originalPrice || 0) * (item.qty || 1);
    const ratio = totalSubtotal > 0 ? price / totalSubtotal : 0;

    const p = item.personName.trim() || 'Unassigned';
    const personItemCount = uniquePeopleMap.get(p) || 1;

    const itemTax = ratio * taxNominal;
    const itemService = ratio * serviceNominal;
    const itemDiscount = ratio * discountNominal;

    // Flat fees divided evenly per person, then assigned to their items
    const itemDelivery = deliveryPerPerson / personItemCount;
    const itemAdmin = adminPerPerson / personItemCount;

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
}
