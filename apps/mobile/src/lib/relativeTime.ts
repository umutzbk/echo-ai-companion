/** Human "2 hours earlier" / "the next day" style differences between two timestamps. */
export function relativeBetween(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso || !toIso) return null;
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  const diffMin = Math.round((to - from) / 60000);
  const abs = Math.abs(diffMin);
  const dir = diffMin >= 0 ? 'later' : 'earlier';

  if (abs < 1) return 'moments apart';
  if (abs < 60) return `${abs} min ${dir}`;
  const hours = Math.round(abs / 60);
  if (abs < 60 * 24) return `${hours}h ${dir}`;
  const days = Math.round(abs / (60 * 24));
  if (days === 1) return dir === 'later' ? 'the next day' : 'the day before';
  if (days < 14) return `${days} days ${dir}`;
  const weeks = Math.round(days / 7);
  return `${weeks} wk ${dir}`;
}

/** Short clock/date label for a single message. */
export function shortTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
