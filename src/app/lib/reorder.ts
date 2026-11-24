/**
 * New `sort_order` values after a transaction was dragged to another place
 * inside its day (Activity list). Same logic as the mobile app's
 * `lib/core/reorder.dart`, which has the tests (`test/reorder_test.dart`).
 *
 * `day` = the rows of that day in their NEW order, top first. The list is
 * ordered by sort_order descending, so the top row has the biggest value.
 * Returns id → new value for the rows that must be saved:
 *   - normally only the moved row: a value between its new neighbours
 *   - when there is no room between them (rows imported together share one
 *     value), the whole day is renumbered from its top value downwards.
 */
export function planReorder(day: { id: string; sort_order: number }[], movedId: string): Record<string, number> {
  const i = day.findIndex(r => r.id === movedId);
  if (i < 0 || day.length < 2) return {};
  const above = i > 0 ? day[i - 1].sort_order : undefined;
  const below = i < day.length - 1 ? day[i + 1].sort_order : undefined;
  const value = above !== undefined && below !== undefined
    ? (above + below) / 2
    : above !== undefined ? above - 1 : below! + 1;
  if ((above === undefined || value < above) && (below === undefined || value > below)) {
    return value === day[i].sort_order ? {} : { [movedId]: value };
  }
  const top = Math.max(...day.map(r => r.sort_order));
  const changes: Record<string, number> = {};
  day.forEach((r, k) => { if (r.sort_order !== top - k) changes[r.id] = top - k; });
  return changes;
}
