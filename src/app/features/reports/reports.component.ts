import { Component, computed, inject, OnInit } from '@angular/core';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { CareIntakeStore } from '../../core/care-intake.store';
import { ThemeService } from '../../core/theme.service';
import { titleCase, URGENCY_HEX } from '../../core/labels';

interface AgingBucket {
  label: string;
  value: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [NgApexchartsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Reports</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Operational analytics across intake volume, triage urgency, follow-ups, and clinician workload.</p>
      </div>

      @if (store.loading() && store.patients().length === 0) {
        <div class="grid place-items-center py-24 text-slate-400">Loading…</div>
      } @else if (store.error()) {
        <div class="card p-6 text-rose-600 dark:text-rose-300">{{ store.error() }}</div>
      } @else {
        <!-- Summary tiles -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          @for (tile of tiles(); track tile.label) {
            <div class="card p-4">
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ tile.label }}</p>
              <p class="mt-1 text-2xl font-bold tabular-nums" [class]="tile.accent">{{ tile.value }}</p>
            </div>
          }
        </div>

        <!-- Intake volume -->
        <div class="card p-5">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Intake volume</h2>
            <span class="text-xs text-slate-400">Last {{ volumeXAxis().categories?.length || 0 }} days</span>
          </div>
          @if (hasVolume()) {
            <apx-chart
              [series]="volumeSeries()"
              [chart]="volumeChart()"
              [xaxis]="volumeXAxis()"
              [stroke]="smoothStroke"
              [fill]="areaFill"
              [dataLabels]="noLabels"
              [grid]="grid()"
              [tooltip]="tooltip()"
              [colors]="['#6366f1']"
            />
          } @else {
            <p class="py-10 text-center text-sm text-slate-400">No intake volume data.</p>
          }
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Triage urgency trend -->
          <div class="card p-5">
            <h2 class="mb-2 text-sm font-semibold">Triage urgency trend</h2>
            @if (urgencyTotal() > 0) {
              <apx-chart
                [series]="urgencySeries()"
                [chart]="donutChart()"
                [labels]="urgencyLabels"
                [colors]="urgencyColors"
                [legend]="legend()"
                [dataLabels]="percentLabels"
                [stroke]="{ width: 0 }"
              />
            } @else {
              <p class="py-10 text-center text-sm text-slate-400">No triage suggestions yet.</p>
            }
          </div>

          <!-- Follow-up completion -->
          <div class="card p-5">
            <h2 class="mb-2 text-sm font-semibold">Follow-up completion</h2>
            <div class="flex items-end justify-between gap-2">
              <p class="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{{ followUp().pct }}%</p>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                {{ followUp().done }} of {{ followUp().total }} done
              </p>
            </div>
            <div class="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div class="h-full rounded-full bg-emerald-500 transition-all" [style.width.%]="followUp().pct"></div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{{ followUp().done }} done</span>
              <span class="chip bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{{ followUp().todo }} to do</span>
            </div>
          </div>
        </div>

        <!-- Clinician workload -->
        <div class="card p-5">
          <h2 class="mb-2 text-sm font-semibold">Clinician workload</h2>
          @if (clinicianSeries()[0].data.length) {
            <apx-chart
              [series]="clinicianSeries()"
              [chart]="hBarChart()"
              [xaxis]="clinicianXAxis()"
              [plotOptions]="hBarPlot"
              [dataLabels]="hBarLabels()"
              [grid]="grid()"
              [colors]="['#6366f1']"
              [tooltip]="tooltip()"
              [legend]="{ show: false }"
            />
          } @else {
            <p class="py-10 text-center text-sm text-slate-400">No appointments to chart.</p>
          }
        </div>

        <!-- Queue aging -->
        <div class="card p-5">
          <h2 class="mb-3 text-sm font-semibold">Queue aging</h2>
          @if (agingTotal() > 0) {
            <ul class="space-y-2.5">
              @for (bucket of aging(); track bucket.label) {
                <li class="flex items-center gap-3">
                  <span class="w-24 shrink-0 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{{ bucket.label }}</span>
                  <div class="h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                    <div
                      class="h-full rounded-md"
                      [class]="agingColor(bucket.label)"
                      [style.width.%]="agingPct(bucket.value)"
                    ></div>
                  </div>
                  <span class="w-8 shrink-0 text-right text-sm font-semibold tabular-nums">{{ bucket.value }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="py-10 text-center text-sm text-slate-400">No appointments to age.</p>
          }
        </div>
      }
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  protected readonly store = inject(CareIntakeStore);
  private readonly theme = inject(ThemeService);
  protected readonly titleCase = titleCase;

  ngOnInit(): void {
    if (this.store.patients().length === 0) {
      void this.store.refreshDashboard();
    }
  }

  // --- summary tiles ---
  protected readonly tiles = computed(() => {
    const appts = this.store.appointments().length;
    const triage = this.store.triageSuggestions().length;
    const fu = this.followUp();
    const overdue = this.aging().find((b) => b.label === 'Overdue')?.value ?? 0;
    return [
      { label: 'Appointments', value: appts, accent: 'text-indigo-600 dark:text-indigo-400' },
      { label: 'Triage suggestions', value: triage, accent: '' },
      { label: 'Follow-up rate', value: fu.pct + '%', accent: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Overdue', value: overdue, accent: 'text-rose-600 dark:text-rose-400' },
    ];
  });

  // --- intake volume ---
  protected readonly hasVolume = computed(() => (this.store.analytics()?.intakeVolume.length ?? 0) > 0);
  protected readonly volumeSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Appointments', data: this.store.analytics()?.intakeVolume.map((p) => p.value) ?? [] },
  ]);

  // --- triage urgency trend ---
  private readonly urgencyOrder: Array<'routine' | 'soon' | 'urgent'> = ['routine', 'soon', 'urgent'];
  protected readonly urgencyLabels = this.urgencyOrder.map((u) => titleCase(u));
  protected readonly urgencyColors = this.urgencyOrder.map((u) => URGENCY_HEX[u]);
  private readonly urgencyCounts = computed(() => {
    const counts: Record<string, number> = { routine: 0, soon: 0, urgent: 0 };
    for (const t of this.store.triageSuggestions()) counts[t.urgency] = (counts[t.urgency] ?? 0) + 1;
    return this.urgencyOrder.map((u) => counts[u]);
  });
  protected readonly urgencySeries = computed<ApexNonAxisChartSeries>(() => this.urgencyCounts());
  protected readonly urgencyTotal = computed(() => this.urgencyCounts().reduce((a, b) => a + b, 0));

  // --- follow-up completion ---
  protected readonly followUp = computed(() => {
    const tasks = this.store.followUpTasks();
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    return { total, done, todo: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
  });

  // --- clinician workload ---
  private readonly clinicianBuckets = computed(() => {
    const counts = new Map<string, number>();
    for (const a of this.store.appointments()) {
      counts.set(a.clinician, (counts.get(a.clinician) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  });
  protected readonly clinicianSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Appointments', data: this.clinicianBuckets().map(([, v]) => v) },
  ]);
  protected readonly clinicianXAxis = computed<ApexXAxis>(() => ({
    categories: this.clinicianBuckets().map(([name]) => name),
  }));

  // --- queue aging ---
  protected readonly aging = computed<AgingBucket[]>(() => {
    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startOfDay.getTime() + 24 * 60 * 60 * 1000;
    const weekEnd = startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000;
    const buckets: Record<string, number> = { Overdue: 0, Today: 0, 'This week': 0, Later: 0 };
    for (const a of this.store.appointments()) {
      const when = new Date(a.scheduledFor).getTime();
      if (Number.isNaN(when)) continue;
      if (when < now) buckets['Overdue']++;
      else if (when < endOfDay) buckets['Today']++;
      else if (when < weekEnd) buckets['This week']++;
      else buckets['Later']++;
    }
    return Object.entries(buckets).map(([label, value]) => ({ label, value }));
  });
  protected readonly agingTotal = computed(() => this.aging().reduce((a, b) => a + b.value, 0));
  private readonly agingMax = computed(() => Math.max(1, ...this.aging().map((b) => b.value)));
  protected agingPct(value: number): number {
    return Math.round((value / this.agingMax()) * 100);
  }
  protected agingColor(label: string): string {
    switch (label) {
      case 'Overdue':
        return 'bg-rose-500';
      case 'Today':
        return 'bg-amber-500';
      case 'This week':
        return 'bg-indigo-500';
      default:
        return 'bg-slate-400 dark:bg-slate-500';
    }
  }

  // --- theme-aware chart bits (mirrors dashboard) ---
  private readonly axisColor = computed(() => (this.theme.isDark() ? '#94a3b8' : '#64748b'));
  private readonly gridColor = computed(() => (this.theme.isDark() ? '#1e293b' : '#e2e8f0'));

  protected readonly volumeChart = computed<ApexChart>(() => ({
    type: 'area',
    height: 280,
    toolbar: { show: false },
    foreColor: this.axisColor(),
    fontFamily: 'Inter, sans-serif',
  }));
  protected readonly donutChart = computed<ApexChart>(() => ({
    type: 'donut',
    height: 300,
    foreColor: this.axisColor(),
    fontFamily: 'Inter, sans-serif',
  }));
  protected readonly hBarChart = computed<ApexChart>(() => ({
    type: 'bar',
    height: 320,
    toolbar: { show: false },
    foreColor: this.axisColor(),
    fontFamily: 'Inter, sans-serif',
  }));

  protected readonly volumeXAxis = computed<ApexXAxis>(() => ({
    categories: this.store.analytics()?.intakeVolume.map((p) => this.shortDate(p.date)) ?? [],
    labels: { rotate: 0, hideOverlappingLabels: true },
    tickAmount: 7,
    axisBorder: { show: false },
    axisTicks: { show: false },
  }));

  protected readonly smoothStroke: ApexStroke = { curve: 'smooth', width: 2.5 };
  protected readonly areaFill: ApexFill = {
    type: 'gradient',
    gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05, stops: [0, 100] },
  };
  protected readonly noLabels: ApexDataLabels = { enabled: false };
  protected readonly percentLabels: ApexDataLabels = {
    enabled: true,
    formatter: (val: number) => `${Math.round(val)}%`,
  };
  protected readonly hBarPlot: ApexPlotOptions = {
    bar: { borderRadius: 6, horizontal: true, barHeight: '60%' },
  };
  protected readonly hBarLabels = computed<ApexDataLabels>(() => ({
    enabled: true,
    style: { colors: [this.theme.isDark() ? '#e2e8f0' : '#0f172a'] },
  }));
  protected readonly grid = computed<ApexGrid>(() => ({
    borderColor: this.gridColor(),
    strokeDashArray: 4,
  }));
  protected readonly tooltip = computed<ApexTooltip>(() => ({
    theme: this.theme.isDark() ? 'dark' : 'light',
  }));
  protected readonly legend = computed<ApexLegend>(() => ({
    position: 'bottom',
    labels: { colors: this.axisColor() },
  }));

  private shortDate(ymd: string): string {
    const [y, m, day] = ymd.split('-').map(Number);
    if (!y) return ymd;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, day));
  }
}
