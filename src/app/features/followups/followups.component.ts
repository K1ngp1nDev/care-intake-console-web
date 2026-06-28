import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CareIntakeStore } from '../../core/care-intake.store';
import { FollowUpTaskRecord } from '../../core/types';

interface TaskRow {
  task: FollowUpTaskRecord;
  patientName: string;
  overdue: boolean;
}

@Component({
  selector: 'app-followups',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Follow-up board</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Track open, overdue, and completed follow-up tasks across the clinic queue.</p>
      </div>

      @if (store.loading() && store.patients().length === 0) {
        <div class="card p-8 text-center text-sm text-slate-400">Loading…</div>
      } @else if (store.error()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {{ store.error() }}
        </div>
      } @else {
        <!-- KPI strip -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Open</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ openCount() }}</p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Overdue</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{{ overdueCount() }}</p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Completed</p>
            <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ completedCount() }}</p>
          </div>
          <div class="card p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Completion rate</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ completionRate() }}%</p>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <select class="field sm:w-56" [ngModel]="ownerFilter()" (ngModelChange)="ownerFilter.set($event)" aria-label="Filter by owner">
            <option value="all">All owners</option>
            @for (owner of owners(); track owner) {
              <option [value]="owner">{{ owner }}</option>
            }
          </select>
          <select class="field sm:w-44" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="todo">To do</option>
            <option value="done">Done</option>
          </select>
        </div>

        <!-- Sections -->
        <div class="grid gap-6 lg:grid-cols-3">
          <div class="min-w-0">
            <ng-container
              [ngTemplateOutlet]="section"
              [ngTemplateOutletContext]="{ title: 'Overdue', rows: overdueRows(), accent: 'text-rose-600 dark:text-rose-400', empty: 'No overdue tasks.' }"
            ></ng-container>
          </div>
          <div class="min-w-0">
            <ng-container
              [ngTemplateOutlet]="section"
              [ngTemplateOutletContext]="{ title: 'Due soon / open', rows: openRows(), accent: 'text-amber-600 dark:text-amber-400', empty: 'No open tasks.' }"
            ></ng-container>
          </div>
          <div class="min-w-0">
            <ng-container
              [ngTemplateOutlet]="section"
              [ngTemplateOutletContext]="{ title: 'Completed', rows: completedRows(), accent: 'text-emerald-600 dark:text-emerald-400', empty: 'No completed tasks.' }"
            ></ng-container>
          </div>
        </div>
      }
    </div>

    <ng-template #section let-title="title" let-rows="rows" let-accent="accent" let-empty="empty">
      <div class="card p-4">
        <div class="mb-3 flex items-center justify-between gap-2">
          <h2 class="text-sm font-semibold" [class]="accent">{{ title }}</h2>
          <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ rows.length }}</span>
        </div>
        @if (rows.length === 0) {
          <p class="text-sm text-slate-400">{{ empty }}</p>
        } @else {
          <ul class="space-y-2">
            @for (row of rows; track row.task.id) {
              <li class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium" [class.line-through]="row.task.status === 'done'" [class.text-slate-400]="row.task.status === 'done'">{{ row.task.title }}</p>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ row.patientName }}</p>
                  </div>
                  <span
                    class="chip shrink-0"
                    [class]="row.overdue
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                      : (row.task.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300')"
                    >{{ formatDate(row.task.dueDate) }}</span
                  >
                </div>
                <div class="mt-3 flex items-center justify-between gap-2">
                  <span class="min-w-0 truncate text-xs text-slate-400">{{ row.task.owner }}</span>
                  <button
                    type="button"
                    class="btn !py-1.5 shrink-0"
                    [class.btn-outline]="row.task.status === 'done'"
                    [class.btn-primary]="row.task.status !== 'done'"
                    (click)="store.toggleFollowUp(row.task.id)"
                  >
                    {{ row.task.status === 'done' ? 'Reopen' : 'Mark done' }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </ng-template>
  `,
})
export class FollowupsComponent implements OnInit {
  protected readonly store = inject(CareIntakeStore);

  protected readonly ownerFilter = signal<string>('all');
  protected readonly statusFilter = signal<'all' | 'todo' | 'done'>('all');

  ngOnInit(): void {
    if (this.store.patients().length === 0) {
      void this.store.refreshDashboard();
    }
  }

  private patientName(patientId: number): string {
    return this.store.patients().find((p) => p.id === patientId)?.fullName ?? 'Unknown patient';
  }

  private isOverdue(task: FollowUpTaskRecord): boolean {
    return task.status === 'todo' && new Date(task.dueDate).getTime() < Date.now();
  }

  protected readonly owners = computed<string[]>(() =>
    [...new Set(this.store.followUpTasks().map((t) => t.owner))].sort(),
  );

  private readonly rows = computed<TaskRow[]>(() => {
    const owner = this.ownerFilter();
    const status = this.statusFilter();
    return this.store
      .followUpTasks()
      .filter((t) => (owner === 'all' || t.owner === owner) && (status === 'all' || t.status === status))
      .map((task) => ({
        task,
        patientName: this.patientName(task.patientId),
        overdue: this.isOverdue(task),
      }));
  });

  protected readonly overdueRows = computed<TaskRow[]>(() => this.rows().filter((r) => r.task.status === 'todo' && r.overdue));
  protected readonly openRows = computed<TaskRow[]>(() => this.rows().filter((r) => r.task.status === 'todo' && !r.overdue));
  protected readonly completedRows = computed<TaskRow[]>(() => this.rows().filter((r) => r.task.status === 'done'));

  // KPIs over all tasks (unfiltered).
  protected readonly openCount = computed(() => this.store.followUpTasks().filter((t) => t.status === 'todo').length);
  protected readonly overdueCount = computed(() => this.store.followUpTasks().filter((t) => this.isOverdue(t)).length);
  protected readonly completedCount = computed(() => this.store.followUpTasks().filter((t) => t.status === 'done').length);
  protected readonly completionRate = computed(() => {
    const total = this.store.followUpTasks().length;
    return total === 0 ? 0 : Math.round((this.completedCount() / total) * 100);
  });

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  }
}
