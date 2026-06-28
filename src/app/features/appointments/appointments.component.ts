import { Component, computed, inject, signal, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CareIntakeStore } from '../../core/care-intake.store';
import { AppointmentRecord, PatientRecord, TriageSuggestionRecord } from '../../core/types';
import { REVIEW_CLASS, STATUS_CLASS, titleCase, URGENCY_CLASS } from '../../core/labels';

interface AgendaItem {
  appointment: AppointmentRecord;
  patient: PatientRecord | undefined;
}

interface AgendaDay {
  key: string;
  label: string;
  items: AgendaItem[];
}

@Component({
  selector: 'app-appointments',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Appointments</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">A day-by-day agenda of scheduled visits. Filter, search, then check in or reschedule.</p>
      </div>

      @if (store.loading() && store.patients().length === 0) {
        <div class="card p-8 text-center text-sm text-slate-400">Loading…</div>
      } @else {
        @if (store.error()) {
          <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {{ store.error() }}
          </div>
        }

        <!-- Toolbar -->
        <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div class="relative min-w-0 flex-1">
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
            <input
              class="field pl-9"
              placeholder="Search by patient, visit type, clinician…"
              [ngModel]="search()"
              (ngModelChange)="search.set($event)"
              aria-label="Search appointments"
            />
          </div>
          <select class="field sm:w-44" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" aria-label="Filter by status">
            <option value="all">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="checked_in">Checked in</option>
            <option value="triaged">Triaged</option>
            <option value="follow_up">Follow up</option>
          </select>
          <select class="field sm:w-48" [ngModel]="clinicianFilter()" (ngModelChange)="clinicianFilter.set($event)" aria-label="Filter by clinician">
            <option value="all">All clinicians</option>
            @for (c of clinicians(); track c) {
              <option [value]="c">{{ c }}</option>
            }
          </select>
          <select class="field sm:w-40" [ngModel]="urgencyFilter()" (ngModelChange)="urgencyFilter.set($event)" aria-label="Filter by urgency">
            <option value="all">All urgency</option>
            <option value="routine">Routine</option>
            <option value="soon">Soon</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ resultCount() }} of {{ store.appointments().length }} appointments
        </p>

        <!-- Agenda -->
        @if (agenda().length === 0) {
          <div class="card p-8 text-center text-sm text-slate-400">No appointments match your filters.</div>
        } @else {
          <div class="space-y-6">
            @for (day of agenda(); track day.key) {
              <div class="space-y-2">
                <div class="sticky top-16 z-10 flex items-center gap-3 bg-slate-50/90 py-1 backdrop-blur dark:bg-slate-950/90">
                  <h2 class="text-sm font-bold">{{ day.label }}</h2>
                  <span class="text-xs text-slate-400">{{ day.items.length }} visit{{ day.items.length === 1 ? '' : 's' }}</span>
                </div>
                <div class="space-y-2">
                  @for (item of day.items; track item.appointment.id) {
                    <button
                      type="button"
                      (click)="open(item.appointment.id)"
                      class="card flex w-full items-start gap-3 p-4 text-left transition hover:border-indigo-300 dark:hover:border-indigo-500/50"
                    >
                      <span class="shrink-0 w-16 pt-0.5 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{{ formatTime(item.appointment.scheduledFor) }}</span>
                      <div class="min-w-0 flex-1">
                        <p class="truncate font-semibold">{{ item.patient?.fullName ?? 'Unknown patient' }}</p>
                        <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ item.appointment.visitType }} · {{ item.appointment.clinician }}</p>
                      </div>
                      <div class="flex shrink-0 flex-col items-end gap-1.5">
                        <span class="chip" [class]="statusClass(item.appointment.status)">{{ titleCase(item.appointment.status) }}</span>
                        <span class="chip" [class]="urgencyClass(item.appointment.urgency)">{{ titleCase(item.appointment.urgency) }}</span>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      }
    </div>

    <!-- Detail modal -->
    @if (selected(); as appt) {
      <div
        class="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
        (click)="close()"
        role="dialog"
        aria-modal="true"
      >
        <div class="card w-full max-w-lg space-y-5 p-5" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-lg font-bold">{{ patientFor(appt)?.fullName ?? 'Unknown patient' }}</h2>
              <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ formatDate(appt.scheduledFor) }}</p>
            </div>
            <button type="button" class="btn btn-ghost !px-2 !py-1" (click)="close()" aria-label="Close">✕</button>
          </div>

          <div class="flex flex-wrap gap-2">
            <span class="chip" [class]="statusClass(appt.status)">{{ titleCase(appt.status) }}</span>
            <span class="chip" [class]="urgencyClass(appt.urgency)">{{ titleCase(appt.urgency) }}</span>
          </div>

          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div class="min-w-0"><dt class="text-xs text-slate-400">Visit type</dt><dd class="truncate font-medium">{{ appt.visitType }}</dd></div>
            <div class="min-w-0"><dt class="text-xs text-slate-400">Clinician</dt><dd class="truncate font-medium">{{ appt.clinician }}</dd></div>
            <div class="min-w-0"><dt class="text-xs text-slate-400">Location</dt><dd class="truncate font-medium">{{ appt.location }}</dd></div>
            <div class="min-w-0"><dt class="text-xs text-slate-400">Scheduled</dt><dd class="truncate font-medium">{{ formatDate(appt.scheduledFor) }}</dd></div>
          </dl>

          <!-- Linked triage -->
          @if (triageFor(appt); as triage) {
            <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div class="mb-2 flex items-center justify-between gap-2">
                <h3 class="text-sm font-semibold">Triage suggestion</h3>
                <div class="flex items-center gap-2">
                  <span class="chip" [class]="reviewClass(triage.reviewStatus)">{{ titleCase(triage.reviewStatus) }}</span>
                  <span class="text-xs text-slate-400">{{ percent(triage.confidence) }}% confidence</span>
                </div>
              </div>
              <p class="text-sm text-slate-700 dark:text-slate-200">{{ triage.summary }}</p>
            </div>
          } @else {
            <div class="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400 dark:border-slate-700">
              No triage suggestion linked to this appointment yet.
            </div>
          }

          <!-- Demo actions -->
          <div class="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div class="flex flex-wrap items-center gap-2">
              <button
                class="btn btn-primary !py-1.5"
                [disabled]="appt.status === 'checked_in'"
                (click)="store.setAppointmentStatus(appt.id, 'checked_in')"
              >
                Check in
              </button>
              @if (appt.status === 'checked_in') {
                <span class="text-xs text-emerald-600 dark:text-emerald-400">Patient checked in</span>
              }
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label class="min-w-0 flex-1">
                <span class="mb-1 block text-xs font-semibold text-slate-400">Reschedule</span>
                <input
                  type="datetime-local"
                  class="field"
                  [ngModel]="rescheduleValue()"
                  (ngModelChange)="rescheduleValue.set($event)"
                  aria-label="New date and time"
                />
              </label>
              <button
                class="btn btn-outline !py-2"
                [disabled]="!rescheduleValue()"
                (click)="saveReschedule(appt.id)"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppointmentsComponent implements OnInit {
  protected readonly store = inject(CareIntakeStore);
  protected readonly titleCase = titleCase;

  protected readonly search = signal('');
  protected readonly statusFilter = signal<string>('all');
  protected readonly clinicianFilter = signal<string>('all');
  protected readonly urgencyFilter = signal<string>('all');

  protected readonly selectedId = signal<number | null>(null);
  protected readonly rescheduleValue = signal<string>('');

  ngOnInit(): void {
    if (this.store.patients().length === 0) {
      void this.store.refreshDashboard();
    }
  }

  protected readonly clinicians = computed(() =>
    Array.from(new Set(this.store.appointments().map((a) => a.clinician))).sort(),
  );

  protected readonly filtered = computed<AppointmentRecord[]>(() => {
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const clinician = this.clinicianFilter();
    const urgency = this.urgencyFilter();
    const patients = this.store.patients();
    return this.store.appointments().filter((a) => {
      if (status !== 'all' && a.status !== status) return false;
      if (clinician !== 'all' && a.clinician !== clinician) return false;
      if (urgency !== 'all' && a.urgency !== urgency) return false;
      if (!query) return true;
      const name = patients.find((p) => p.id === a.patientId)?.fullName ?? '';
      const haystack = `${name} ${a.visitType} ${a.clinician}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  protected readonly resultCount = computed(() => this.filtered().length);

  protected readonly agenda = computed<AgendaDay[]>(() => {
    const patients = this.store.patients();
    const sorted = [...this.filtered()].sort(
      (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );
    const map = new Map<string, AgendaDay>();
    for (const appointment of sorted) {
      const d = new Date(appointment.scheduledFor);
      const key = Number.isNaN(d.getTime()) ? appointment.scheduledFor : d.toISOString().slice(0, 10);
      let day = map.get(key);
      if (!day) {
        day = { key, label: this.formatDayHeader(appointment.scheduledFor), items: [] };
        map.set(key, day);
      }
      day.items.push({
        appointment,
        patient: patients.find((p) => p.id === appointment.patientId),
      });
    }
    return Array.from(map.values());
  });

  protected readonly selected = computed<AppointmentRecord | null>(() => {
    const id = this.selectedId();
    if (id === null) return null;
    return this.store.appointments().find((a) => a.id === id) ?? null;
  });

  protected open(id: number) {
    this.selectedId.set(id);
    this.rescheduleValue.set('');
  }

  protected close() {
    this.selectedId.set(null);
    this.rescheduleValue.set('');
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    if (this.selectedId() !== null) this.close();
  }

  protected saveReschedule(id: number) {
    const value = this.rescheduleValue();
    if (!value) return;
    const iso = new Date(value).toISOString();
    this.store.rescheduleAppointment(id, iso);
    this.rescheduleValue.set('');
  }

  protected patientFor(appt: AppointmentRecord): PatientRecord | undefined {
    return this.store.patients().find((p) => p.id === appt.patientId);
  }

  protected triageFor(appt: AppointmentRecord): TriageSuggestionRecord | undefined {
    return this.store.triageSuggestions().find((t) => t.appointmentId === appt.id);
  }

  protected statusClass(s: string) {
    return STATUS_CLASS[s] ?? 'bg-slate-100 text-slate-600';
  }
  protected urgencyClass(u: string) {
    return URGENCY_CLASS[u] ?? 'bg-slate-100 text-slate-600';
  }
  protected reviewClass(r: string) {
    return REVIEW_CLASS[r] ?? 'bg-slate-100 text-slate-600';
  }
  protected percent(confidence: number) {
    return Math.round(confidence * 100);
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  }

  protected formatDayHeader(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }).format(d);
  }

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  }
}
