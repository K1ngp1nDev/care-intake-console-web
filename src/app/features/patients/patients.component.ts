import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CareIntakeStore } from '../../core/care-intake.store';
import { STATUS_CLASS, titleCase, URGENCY_CLASS } from '../../core/labels';
import { AppointmentRecord, FollowUpTaskRecord, PatientRecord, Urgency } from '../../core/types';

interface PatientRow {
  patient: PatientRecord;
  appointments: AppointmentRecord[];
  appointmentCount: number;
  currentUrgency: Urgency | null;
  highRisk: boolean;
}

const URGENCY_RANK: Record<Urgency, number> = { routine: 0, soon: 1, urgent: 2 };

@Component({
  selector: 'app-patients',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Patient directory</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Browse the synthetic patient roster, filter by tag or urgency, and open a patient for visit history.</p>
      </div>

      @if (store.error()) {
        <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {{ store.error() }}
        </div>
      }

      @if (store.loading() && store.patients().length === 0) {
        <div class="card p-8 text-center text-sm text-slate-400">Loading…</div>
      } @else {
        <!-- Toolbar -->
        <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div class="relative flex-1">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input
              class="field pl-9"
              placeholder="Search by name or email…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              aria-label="Search patients"
            />
          </div>
          <select class="field sm:w-48" [ngModel]="tagFilter()" (ngModelChange)="tagFilter.set($event)" aria-label="Filter by tag">
            <option value="all">All tags</option>
            @for (tag of allTags(); track tag) {
              <option [value]="tag">{{ tag }}</option>
            }
          </select>
          <select class="field sm:w-40" [ngModel]="urgencyFilter()" (ngModelChange)="urgencyFilter.set($event)" aria-label="Filter by current urgency">
            <option value="all">All urgency</option>
            <option value="routine">Routine</option>
            <option value="soon">Soon</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ filteredRows().length }} of {{ rows().length }} patients
        </p>

        @if (filteredRows().length === 0) {
          <div class="card p-8 text-center text-sm text-slate-400">No patients match your filters.</div>
        } @else {
          <!-- Desktop table -->
          <div class="card hidden overflow-x-auto p-0 md:block">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <tr>
                  <th class="px-4 py-3 font-semibold">Patient</th>
                  <th class="px-4 py-3 font-semibold">Tags</th>
                  <th class="px-4 py-3 font-semibold">Date of birth</th>
                  <th class="px-4 py-3 font-semibold">Contact</th>
                  <th class="px-4 py-3 font-semibold">Urgency</th>
                  <th class="px-4 py-3 text-right font-semibold">Appts</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.patient.id) {
                  <tr
                    (click)="open(row)"
                    class="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td class="px-4 py-3">
                      <div class="min-w-0">
                        <p class="truncate font-semibold">{{ row.patient.fullName }}</p>
                        <p class="truncate text-xs text-slate-400">#{{ row.patient.id }}</p>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="flex max-w-[180px] flex-wrap gap-1">
                        @for (tag of row.patient.tags; track tag) {
                          <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ tag }}</span>
                        } @empty {
                          <span class="text-xs text-slate-400">—</span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 text-slate-600 dark:text-slate-300">{{ formatDob(row.patient.dateOfBirth) }}</td>
                    <td class="px-4 py-3">
                      <div class="max-w-[200px] min-w-0">
                        <p class="truncate">{{ row.patient.phone }}</p>
                        <p class="truncate text-xs text-slate-400">{{ row.patient.email }}</p>
                      </div>
                    </td>
                    <td class="px-4 py-3">
                      @if (row.currentUrgency) {
                        <span class="chip" [class]="urgencyClass(row.currentUrgency)">{{ titleCase(row.currentUrgency) }}</span>
                      } @else {
                        <span class="text-xs text-slate-400">—</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right font-semibold tabular-nums">{{ row.appointmentCount }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="space-y-2 md:hidden">
            @for (row of filteredRows(); track row.patient.id) {
              <button
                type="button"
                (click)="open(row)"
                class="card w-full p-4 text-left transition hover:border-indigo-300 dark:hover:border-indigo-500/50"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate font-semibold">{{ row.patient.fullName }}</p>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ row.patient.email }}</p>
                  </div>
                  @if (row.currentUrgency) {
                    <span class="chip shrink-0" [class]="urgencyClass(row.currentUrgency)">{{ titleCase(row.currentUrgency) }}</span>
                  }
                </div>
                <div class="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span class="truncate">DOB {{ formatDob(row.patient.dateOfBirth) }} · {{ row.patient.phone }}</span>
                  <span class="shrink-0">{{ row.appointmentCount }} appt{{ row.appointmentCount === 1 ? '' : 's' }}</span>
                </div>
                @if (row.patient.tags.length) {
                  <div class="mt-2 flex flex-wrap gap-1">
                    @for (tag of row.patient.tags; track tag) {
                      <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ tag }}</span>
                    }
                  </div>
                }
              </button>
            }
          </div>
        }
      }

      <!-- Detail modal -->
      @if (selected(); as row) {
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          (click)="close()"
        >
          <div
            class="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-5"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-lg font-bold">{{ row.patient.fullName }}</h2>
                <p class="truncate text-sm text-slate-500 dark:text-slate-400">Patient #{{ row.patient.id }}</p>
              </div>
              <div class="flex items-center gap-2">
                <span
                  class="chip"
                  [class]="row.highRisk
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'"
                >{{ row.highRisk ? 'High risk' : 'Stable' }}</span>
                <button
                  type="button"
                  (click)="close()"
                  class="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Close"
                >✕</button>
              </div>
            </div>

            <!-- Demographics -->
            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><dt class="text-xs text-slate-400">Date of birth</dt><dd class="font-medium">{{ formatDob(row.patient.dateOfBirth) }}</dd></div>
              <div><dt class="text-xs text-slate-400">Phone</dt><dd class="truncate font-medium">{{ row.patient.phone }}</dd></div>
              <div class="col-span-2"><dt class="text-xs text-slate-400">Email</dt><dd class="truncate font-medium">{{ row.patient.email }}</dd></div>
            </dl>

            @if (row.patient.tags.length) {
              <div class="mt-3 flex flex-wrap gap-1.5">
                @for (tag of row.patient.tags; track tag) {
                  <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ tag }}</span>
                }
              </div>
            }

            <!-- Visit history -->
            <div class="mt-5">
              <h3 class="mb-2 text-sm font-semibold">Visit history</h3>
              @if (row.appointments.length) {
                <ul class="space-y-2">
                  @for (appt of row.appointments; track appt.id) {
                    <li class="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="truncate text-sm font-medium">{{ appt.visitType }}</p>
                          <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ appt.clinician }} · {{ appt.location }}</p>
                        </div>
                        <span class="shrink-0 text-xs text-slate-400">{{ formatDate(appt.scheduledFor) }}</span>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        <span class="chip" [class]="statusClass(appt.status)">{{ titleCase(appt.status) }}</span>
                        <span class="chip" [class]="urgencyClass(appt.urgency)">{{ titleCase(appt.urgency) }}</span>
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-slate-400">No visits on record.</p>
              }
            </div>

            <!-- Follow-up tasks -->
            <div class="mt-5">
              <h3 class="mb-2 text-sm font-semibold">Follow-up tasks</h3>
              @if (tasksFor(row.patient.id).length) {
                <ul class="space-y-1.5">
                  @for (task of tasksFor(row.patient.id); track task.id) {
                    <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                      <span class="min-w-0 truncate">{{ task.title }} <span class="text-xs text-slate-400">· {{ task.owner }}</span></span>
                      <span class="chip shrink-0" [class]="task.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">{{ task.status }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-slate-400">No follow-up tasks yet.</p>
              }
            </div>

            <p class="mt-5 text-xs text-slate-400">Synthetic demo data — not a medical record.</p>
          </div>
        </div>
      }
    </div>
  `,
})
export class PatientsComponent implements OnInit {
  protected readonly store = inject(CareIntakeStore);
  protected readonly titleCase = titleCase;

  protected readonly search = signal('');
  protected readonly tagFilter = signal<'all' | string>('all');
  protected readonly urgencyFilter = signal<'all' | Urgency>('all');
  protected readonly selectedId = signal<number | null>(null);

  protected readonly rows = computed<PatientRow[]>(() => {
    const appointments = this.store.appointments();
    return this.store.patients().map((patient) => {
      const appts = appointments
        .filter((a) => a.patientId === patient.id)
        .sort((a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime());
      let currentUrgency: Urgency | null = null;
      for (const a of appts) {
        if (currentUrgency === null || URGENCY_RANK[a.urgency] > URGENCY_RANK[currentUrgency]) {
          currentUrgency = a.urgency;
        }
      }
      const highRisk =
        currentUrgency === 'urgent' ||
        patient.tags.some((t) => t.toLowerCase().includes('high-risk'));
      return {
        patient,
        appointments: appts,
        appointmentCount: appts.length,
        currentUrgency,
        highRisk,
      };
    });
  });

  protected readonly allTags = computed<string[]>(() => {
    const set = new Set<string>();
    for (const p of this.store.patients()) {
      for (const t of p.tags) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  protected readonly filteredRows = computed<PatientRow[]>(() => {
    const query = this.search().trim().toLowerCase();
    const tag = this.tagFilter();
    const urgency = this.urgencyFilter();
    return this.rows().filter((row) => {
      if (tag !== 'all' && !row.patient.tags.includes(tag)) return false;
      if (urgency !== 'all' && row.currentUrgency !== urgency) return false;
      if (!query) return true;
      const haystack = `${row.patient.fullName} ${row.patient.email}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly selected = computed<PatientRow | null>(() => {
    const id = this.selectedId();
    if (id === null) return null;
    return this.rows().find((r) => r.patient.id === id) ?? null;
  });

  ngOnInit(): void {
    if (this.store.patients().length === 0) {
      void this.store.refreshDashboard();
    }
  }

  protected tasksFor(patientId: number): FollowUpTaskRecord[] {
    return this.store.followUpTasks().filter((t) => t.patientId === patientId);
  }

  protected open(row: PatientRow): void {
    this.selectedId.set(row.patient.id);
  }

  protected close(): void {
    this.selectedId.set(null);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.selectedId() !== null) this.close();
  }

  protected statusClass(s: string) {
    return STATUS_CLASS[s] ?? 'bg-slate-100 text-slate-600';
  }
  protected urgencyClass(u: string) {
    return URGENCY_CLASS[u] ?? 'bg-slate-100 text-slate-600';
  }

  protected formatDob(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  }

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  }
}
