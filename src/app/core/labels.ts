// Shared label + color helpers for statuses, urgencies, and review states.

export const URGENCY_CLASS: Record<string, string> = {
  routine: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  soon: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

export const STATUS_CLASS: Record<string, string> = {
  scheduled: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300',
  checked_in: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  triaged: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  follow_up: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
};

export const REVIEW_CLASS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  edited: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

// Hex palettes for ApexCharts (theme-independent accent colors).
export const URGENCY_HEX: Record<string, string> = {
  routine: '#10b981',
  soon: '#f59e0b',
  urgent: '#f43f5e',
};

export const STATUS_HEX: Record<string, string> = {
  scheduled: '#94a3b8',
  checked_in: '#0ea5e9',
  triaged: '#6366f1',
  follow_up: '#8b5cf6',
};

export function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
