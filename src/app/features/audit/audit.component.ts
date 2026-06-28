import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CareIntakeStore } from '../../core/care-intake.store';
import { titleCase } from '../../core/labels';
import { AuditEvent } from '../../core/types';

type TypeFilter = 'all' | AuditEvent['type'];
type SeverityFilter = 'all' | AuditEvent['severity'];

interface DayGroup {
  key: string;
  label: string;
  events: AuditEvent[];
}

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Activity timeline</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">A running operational log of intake, triage, and follow-up events across the clinic queue.</p>
      </div>

      @if (store.loading() && store.patients().length === 0) {
        <div class="card p-8 text-center text-sm text-slate-400">Loading…</div>
      } @else {
        @if (store.error(); as err) {
          <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{{ err }}</div>
        }

        <!-- KPI strip -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total events</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ store.audit().length }}</p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Warnings</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{{ warningCount() }}</p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Triage events</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{{ triageCount() }}</p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Completed follow-ups</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ completedFollowUps() }}</p>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <select class="field sm:w-48" [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)" aria-label="Filter by type">
            <option value="all">All types</option>
            <option value="patient">Patient</option>
            <option value="appointment">Appointment</option>
            <option value="intake">Intake</option>
            <option value="triage">Triage</option>
            <option value="followup">Follow-up</option>
          </select>
          <select class="field sm:w-48" [ngModel]="severityFilter()" (ngModelChange)="severityFilter.set($event)" aria-label="Filter by severity">
            <option value="all">All severities</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
          </select>
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-400 sm:ml-auto">
            {{ filteredEvents().length }} of {{ store.audit().length }} events
          </span>
        </div>

        <!-- Timeline -->
        @if (filteredEvents().length === 0) {
          <div class="card p-8 text-center text-sm text-slate-400">No events match your filters.</div>
        } @else {
          <div class="space-y-6">
            @for (group of groupedEvents(); track group.key) {
              <div class="space-y-3">
                <h2 class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ group.label }}</h2>
                <ol class="relative space-y-3 border-l border-slate-200 pl-5 dark:border-slate-800">
                  @for (event of group.events; track event.id) {
                    <li class="relative">
                      <span
                        class="absolute -left-[1.4rem] top-1.5 h-3 w-3 rounded-full ring-4 ring-white dark:ring-slate-950"
                        [class]="dotClass(event.severity)"
                        aria-hidden="true"
                      ></span>
                      <div class="card min-w-0 p-4">
                        <div class="flex flex-wrap items-start justify-between gap-2">
                          <div class="min-w-0 flex-1">
                            <p class="truncate font-semibold">{{ event.title }}</p>
                            <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{{ event.detail }}</p>
                          </div>
                          <span class="shrink-0 text-xs text-slate-400">{{ formatTime(event.at) }}</span>
                        </div>
                        <div class="mt-2 flex flex-wrap items-center gap-2">
                          <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ titleCase(event.type) }}</span>
                          <span class="chip" [class]="severityClass(event.severity)">{{ titleCase(event.severity) }}</span>
                        </div>
                      </div>
                    </li>
                  }
                </ol>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class AuditComponent implements OnInit {
  protected readonly store = inject(CareIntakeStore);
  protected readonly titleCase = titleCase;

  protected readonly typeFilter = signal<TypeFilter>('all');
  protected readonly severityFilter = signal<SeverityFilter>('all');

  ngOnInit(): void {
    if (this.store.patients().length === 0) {
      void this.store.refreshDashboard();
    }
  }

  protected readonly warningCount = computed(
    () => this.store.audit().filter((e) => e.severity === 'warning').length,
  );
  protected readonly triageCount = computed(
    () => this.store.audit().filter((e) => e.type === 'triage').length,
  );
  protected readonly completedFollowUps = computed(
    () => this.store.followUpTasks().filter((t) => t.status === 'done').length,
  );

  protected readonly filteredEvents = computed<AuditEvent[]>(() => {
    const type = this.typeFilter();
    const severity = this.severityFilter();
    return this.store.audit().filter((e) => {
      if (type !== 'all' && e.type !== type) return false;
      if (severity !== 'all' && e.severity !== severity) return false;
      return true;
    });
  });

  protected readonly groupedEvents = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    const byKey = new Map<string, DayGroup>();
    for (const event of this.filteredEvents()) {
      const d = new Date(event.at);
      const key = Number.isNaN(d.getTime()) ? event.at : d.toISOString().slice(0, 10);
      let group = byKey.get(key);
      if (!group) {
        group = { key, label: this.formatDayLabel(d, event.at), events: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.events.push(event);
    }
    return groups;
  });

  protected dotClass(severity: AuditEvent['severity']): string {
    switch (severity) {
      case 'success':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      default:
        return 'bg-sky-500';
    }
  }

  protected severityClass(severity: AuditEvent['severity']): string {
    switch (severity) {
      case 'success':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
      case 'warning':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
      default:
        return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
    }
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  }

  private formatDayLabel(d: Date, fallback: string): string {
    if (Number.isNaN(d.getTime())) return fallback;
    const today = new Date();
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
    }).format(d);
  }
}
