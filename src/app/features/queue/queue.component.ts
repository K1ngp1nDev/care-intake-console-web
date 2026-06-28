import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CareIntakeStore } from '../../core/care-intake.store';
import { REVIEW_CLASS, STATUS_CLASS, titleCase, URGENCY_CLASS } from '../../core/labels';

@Component({
  selector: 'app-queue',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Intake queue</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Search and filter the live appointment queue, then review triage and follow-ups.</p>
      </div>

      <!-- Toolbar -->
      <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
          <input
            class="field pl-9"
            placeholder="Search by patient, visit type, clinician…"
            [ngModel]="store.queueSearch()"
            (ngModelChange)="store.queueSearch.set($event)"
            aria-label="Search queue"
          />
        </div>
        <select class="field sm:w-44" [ngModel]="store.queueStatus()" (ngModelChange)="store.queueStatus.set($event)" aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="checked_in">Checked in</option>
          <option value="triaged">Triaged</option>
          <option value="follow_up">Follow up</option>
        </select>
        <select class="field sm:w-40" [ngModel]="store.queueUrgency()" (ngModelChange)="store.queueUrgency.set($event)" aria-label="Filter by urgency">
          <option value="all">All urgency</option>
          <option value="routine">Routine</option>
          <option value="soon">Soon</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
        <!-- Queue list -->
        <div class="min-w-0 space-y-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {{ store.filteredQueueRows().length }} of {{ store.queueRows().length }} appointments
          </p>
          @if (store.filteredQueueRows().length === 0) {
            <div class="card p-8 text-center text-sm text-slate-400">No appointments match your filters.</div>
          } @else {
            <div class="space-y-2">
              @for (row of store.filteredQueueRows(); track row.appointment.id) {
                <button
                  type="button"
                  (click)="store.selectedAppointmentId.set(row.appointment.id)"
                  class="card w-full p-4 text-left transition hover:border-indigo-300 dark:hover:border-indigo-500/50"
                  [class.ring-2]="row.appointment.id === store.selectedRow()?.appointment?.id"
                  [class.ring-indigo-500]="row.appointment.id === store.selectedRow()?.appointment?.id"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                      <p class="truncate font-semibold">{{ row.patient?.fullName ?? 'Unknown patient' }}</p>
                      <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ row.appointment.visitType }} · {{ row.appointment.clinician }}</p>
                    </div>
                    <span class="shrink-0 text-xs text-slate-400">{{ formatDate(row.appointment.scheduledFor) }}</span>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2">
                    <span class="chip" [class]="statusClass(row.appointment.status)">{{ titleCase(row.appointment.status) }}</span>
                    <span class="chip" [class]="urgencyClass(row.appointment.urgency)">{{ titleCase(row.appointment.urgency) }}</span>
                  </div>
                </button>
              }
            </div>
          }
        </div>

        <!-- Detail panel -->
        @if (store.selectedRow(); as row) {
          <div data-testid="detail-panel" class="card min-w-0 space-y-5 p-5 lg:sticky lg:top-24 lg:self-start">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="text-lg font-bold">{{ row.patient?.fullName ?? 'Unknown patient' }}</h2>
                <p class="truncate text-sm text-slate-500 dark:text-slate-400">{{ row.patient?.email }}</p>
              </div>
              <div class="flex gap-2">
                <span class="chip" [class]="statusClass(row.appointment.status)">{{ titleCase(row.appointment.status) }}</span>
                <span class="chip" [class]="urgencyClass(row.appointment.urgency)">{{ titleCase(row.appointment.urgency) }}</span>
              </div>
            </div>

            @if (row.patient?.tags?.length) {
              <div class="flex flex-wrap gap-1.5">
                @for (tag of row.patient!.tags; track tag) {
                  <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{{ tag }}</span>
                }
              </div>
            }

            <dl class="grid grid-cols-2 gap-3 text-sm">
              <div><dt class="text-xs text-slate-400">Visit type</dt><dd class="font-medium">{{ row.appointment.visitType }}</dd></div>
              <div><dt class="text-xs text-slate-400">Clinician</dt><dd class="font-medium">{{ row.appointment.clinician }}</dd></div>
              <div><dt class="text-xs text-slate-400">Location</dt><dd class="font-medium">{{ row.appointment.location }}</dd></div>
              <div><dt class="text-xs text-slate-400">Scheduled</dt><dd class="font-medium">{{ formatDate(row.appointment.scheduledFor) }}</dd></div>
            </dl>

            <!-- Triage -->
            @if (row.triage; as triage) {
              <div class="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div class="mb-2 flex items-center justify-between">
                  <h3 class="text-sm font-semibold">Triage suggestion</h3>
                  <div class="flex items-center gap-2">
                    <span class="chip" [class]="reviewClass(triage.reviewStatus)">{{ titleCase(triage.reviewStatus) }}</span>
                    <span class="text-xs text-slate-400">{{ percent(triage.confidence) }}% confidence</span>
                  </div>
                </div>
                <p class="text-sm text-slate-700 dark:text-slate-200">{{ triage.summary }}</p>
                <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ triage.reasoningSnippet }}</p>

                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p class="text-xs font-semibold text-slate-400">Missing info</p>
                    <ul class="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
                      @for (item of triage.missingInfoChecklist; track item) { <li>{{ item }}</li> }
                    </ul>
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-slate-400">Follow-up questions</p>
                    <ul class="mt-1 list-inside list-disc text-xs text-slate-600 dark:text-slate-300">
                      @for (item of triage.followUpQuestions; track item) { <li>{{ item }}</li> }
                    </ul>
                  </div>
                </div>

                <div class="mt-4 flex flex-wrap gap-2">
                  <button class="btn btn-primary !py-1.5" (click)="store.updateTriageDecision(triage.id, 'accepted')">Accept</button>
                  <button class="btn btn-outline !py-1.5" (click)="store.updateTriageDecision(triage.id, 'rejected')">Reject</button>
                  <button class="btn btn-ghost !py-1.5" (click)="store.generateFollowUps(triage.id)">Generate follow-ups</button>
                </div>
              </div>
            } @else {
              <div class="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-400 dark:border-slate-700">
                No triage suggestion for this appointment yet.
              </div>
            }

            <!-- Follow-up tasks -->
            <div>
              <h3 class="mb-2 text-sm font-semibold">Follow-up tasks</h3>
              @if (store.selectedPatientTasks().length) {
                <ul class="space-y-1.5">
                  @for (task of store.selectedPatientTasks(); track task.id) {
                    <li class="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/50">
                      <span class="min-w-0 truncate">{{ task.title }} <span class="text-xs text-slate-400">· {{ task.owner }}</span></span>
                      <span class="chip" [class]="task.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'">{{ task.status }}</span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-sm text-slate-400">No follow-up tasks yet.</p>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class QueueComponent {
  protected readonly store = inject(CareIntakeStore);
  protected readonly titleCase = titleCase;

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
  protected formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  }
}
