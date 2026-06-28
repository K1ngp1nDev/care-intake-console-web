import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CareIntakeStore } from '../../core/care-intake.store';
import { REVIEW_CLASS, titleCase, URGENCY_CLASS } from '../../core/labels';
import { ReviewStatus, TriageSuggestionRecord } from '../../core/types';

interface TriageRow {
  triage: TriageSuggestionRecord;
  patientName: string;
}

@Component({
  selector: 'app-triage',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Triage review</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Human-reviewed intake suggestions. Filter, open a suggestion, and record an operational review decision.
        </p>
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
        <div class="card flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:flex-wrap">
          <select class="field sm:w-44" [ngModel]="reviewFilter()" (ngModelChange)="reviewFilter.set($event)" aria-label="Filter by review status">
            <option value="all">All review states</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="edited">Edited</option>
            <option value="rejected">Rejected</option>
          </select>
          <select class="field sm:w-40" [ngModel]="urgencyFilter()" (ngModelChange)="urgencyFilter.set($event)" aria-label="Filter by urgency">
            <option value="all">All urgency</option>
            <option value="routine">Routine</option>
            <option value="soon">Soon</option>
            <option value="urgent">Urgent</option>
          </select>
          <select class="field sm:w-44" [ngModel]="minConfidence()" (ngModelChange)="minConfidence.set(+$event)" aria-label="Filter by minimum confidence">
            <option [ngValue]="0">Any confidence</option>
            <option [ngValue]="60">≥ 60% confidence</option>
            <option [ngValue]="75">≥ 75% confidence</option>
            <option [ngValue]="90">≥ 90% confidence</option>
          </select>
        </div>

        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {{ filteredRows().length }} of {{ rows().length }} suggestions
        </p>

        @if (filteredRows().length === 0) {
          <div class="card p-8 text-center text-sm text-slate-400">No triage suggestions match your filters.</div>
        } @else {
          <!-- Desktop table -->
          <div class="card hidden overflow-x-auto p-0 md:block">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400 dark:border-slate-800">
                <tr>
                  <th class="px-4 py-3 font-semibold">Patient</th>
                  <th class="px-4 py-3 font-semibold">Urgency</th>
                  <th class="px-4 py-3 font-semibold">Confidence</th>
                  <th class="px-4 py-3 font-semibold">Review</th>
                  <th class="px-4 py-3 font-semibold">Summary</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.triage.id) {
                  <tr
                    (click)="open(row.triage)"
                    class="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td class="px-4 py-3 font-medium">{{ row.patientName }}</td>
                    <td class="px-4 py-3"><span class="chip" [class]="urgencyClass(row.triage.urgency)">{{ titleCase(row.triage.urgency) }}</span></td>
                    <td class="px-4 py-3">
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div class="h-full rounded-full bg-indigo-500" [style.width.%]="percent(row.triage.confidence)"></div>
                        </div>
                        <span class="text-xs tabular-nums text-slate-500 dark:text-slate-400">{{ percent(row.triage.confidence) }}%</span>
                      </div>
                    </td>
                    <td class="px-4 py-3"><span class="chip" [class]="reviewClass(row.triage.reviewStatus)">{{ titleCase(row.triage.reviewStatus) }}</span></td>
                    <td class="max-w-xs px-4 py-3"><span class="block truncate text-slate-600 dark:text-slate-300">{{ row.triage.summary }}</span></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile cards -->
          <div class="space-y-2 md:hidden">
            @for (row of filteredRows(); track row.triage.id) {
              <button
                type="button"
                (click)="open(row.triage)"
                class="card w-full p-4 text-left transition hover:border-indigo-300 dark:hover:border-indigo-500/50"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="min-w-0 truncate font-semibold">{{ row.patientName }}</p>
                  <span class="shrink-0 text-xs tabular-nums text-slate-400">{{ percent(row.triage.confidence) }}%</span>
                </div>
                <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div class="h-full rounded-full bg-indigo-500" [style.width.%]="percent(row.triage.confidence)"></div>
                </div>
                <p class="mt-2 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{{ row.triage.summary }}</p>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span class="chip" [class]="urgencyClass(row.triage.urgency)">{{ titleCase(row.triage.urgency) }}</span>
                  <span class="chip" [class]="reviewClass(row.triage.reviewStatus)">{{ titleCase(row.triage.reviewStatus) }}</span>
                </div>
              </button>
            }
          </div>
        }
      }

      <!-- Detail modal -->
      @if (selected(); as triage) {
        <div
          class="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4"
          (click)="close()"
        >
          <div
            class="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-5"
            (click)="$event.stopPropagation()"
            role="dialog"
            aria-modal="true"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h2 class="truncate text-lg font-bold">{{ patientNameFor(triage) }}</h2>
                <p class="text-xs text-slate-400">Triage suggestion · human-reviewed</p>
              </div>
              <button type="button" class="btn btn-ghost !px-2 !py-1" (click)="close()" aria-label="Close">✕</button>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="chip" [class]="urgencyClass(triage.urgency)">{{ titleCase(triage.urgency) }}</span>
              <span class="chip" [class]="reviewClass(triage.reviewStatus)">{{ titleCase(triage.reviewStatus) }}</span>
              <span class="text-xs text-slate-400">{{ percent(triage.confidence) }}% confidence</span>
            </div>
            <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div class="h-full rounded-full bg-indigo-500" [style.width.%]="percent(triage.confidence)"></div>
            </div>

            <div class="mt-4 space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</p>
              <p class="text-sm text-slate-700 dark:text-slate-200">{{ triage.summary }}</p>
            </div>

            <div class="mt-4 space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Reasoning snippet</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">{{ triage.reasoningSnippet }}</p>
            </div>

            @if (triage.missingInfoChecklist.length) {
              <div class="mt-4 space-y-1">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Missing info</p>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
                  @for (item of triage.missingInfoChecklist; track item) { <li>{{ item }}</li> }
                </ul>
              </div>
            }

            @if (triage.followUpQuestions.length) {
              <div class="mt-4 space-y-1">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Follow-up questions</p>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
                  @for (item of triage.followUpQuestions; track item) { <li>{{ item }}</li> }
                </ul>
              </div>
            }

            @if (triage.visitPrepChecklist.length) {
              <div class="mt-4 space-y-1">
                <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Visit prep</p>
                <ul class="list-inside list-disc text-sm text-slate-600 dark:text-slate-300">
                  @for (item of triage.visitPrepChecklist; track item) { <li>{{ item }}</li> }
                </ul>
              </div>
            }

            <div class="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button class="btn btn-primary !py-1.5" [disabled]="saving()" (click)="decide(triage.id, 'accepted')">Accept</button>
              <button class="btn btn-outline !py-1.5" [disabled]="saving()" (click)="decide(triage.id, 'edited')">Edit</button>
              <button class="btn btn-ghost !py-1.5" [disabled]="saving()" (click)="decide(triage.id, 'rejected')">Reject</button>
              @if (saving()) { <span class="self-center text-xs text-slate-400">Saving…</span> }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class TriageReviewComponent {
  protected readonly store = inject(CareIntakeStore);
  protected readonly titleCase = titleCase;

  protected readonly reviewFilter = signal<'all' | ReviewStatus>('all');
  protected readonly urgencyFilter = signal<'all' | string>('all');
  protected readonly minConfidence = signal(0);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly saving = signal(false);

  protected readonly rows = computed<TriageRow[]>(() => {
    const patients = this.store.patients();
    return this.store.triageSuggestions().map((triage) => ({
      triage,
      patientName: patients.find((p) => p.id === triage.patientId)?.fullName ?? 'Unknown patient',
    }));
  });

  protected readonly filteredRows = computed<TriageRow[]>(() => {
    const review = this.reviewFilter();
    const urgency = this.urgencyFilter();
    const minPct = this.minConfidence();
    return this.rows().filter((row) => {
      if (review !== 'all' && row.triage.reviewStatus !== review) return false;
      if (urgency !== 'all' && row.triage.urgency !== urgency) return false;
      if (minPct > 0 && this.percent(row.triage.confidence) < minPct) return false;
      return true;
    });
  });

  protected readonly selected = computed<TriageSuggestionRecord | null>(() => {
    const id = this.selectedId();
    if (id === null) return null;
    return this.store.triageSuggestions().find((t) => t.id === id) ?? null;
  });

  ngOnInit() {
    if (this.store.patients().length === 0) {
      void this.store.refreshDashboard();
    }
  }

  @HostListener('document:keydown.escape')
  protected onEscape() {
    this.close();
  }

  protected open(triage: TriageSuggestionRecord) {
    this.selectedId.set(triage.id);
  }

  protected close() {
    this.selectedId.set(null);
  }

  protected async decide(triageId: number, reviewStatus: ReviewStatus) {
    this.saving.set(true);
    try {
      await this.store.updateTriageDecision(triageId, reviewStatus);
      this.close();
    } finally {
      this.saving.set(false);
    }
  }

  protected patientNameFor(triage: TriageSuggestionRecord): string {
    return this.store.patients().find((p) => p.id === triage.patientId)?.fullName ?? 'Unknown patient';
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
}
