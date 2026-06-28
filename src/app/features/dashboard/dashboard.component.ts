import { Component, computed, inject } from '@angular/core';
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
import { STATUS_HEX, titleCase, URGENCY_HEX } from '../../core/labels';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgApexchartsModule],
  template: `
    <div class="space-y-6">
      <div>
        <h1 class="text-xl font-bold">Operations overview</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">Live intake, triage, and follow-up metrics across the clinic queue.</p>
      </div>

      @if (kpis(); as k) {
        <!-- KPI cards -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          @for (card of cards(); track card.label) {
            <div class="card p-4">
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ card.label }}</p>
              <p class="mt-1 text-2xl font-bold tabular-nums" [class]="card.accent">{{ card.value }}</p>
            </div>
          }
        </div>

        <!-- Charts -->
        <div class="card p-5">
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold">Intake volume</h2>
            <span class="text-xs text-slate-400">Last 14 days</span>
          </div>
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
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <div class="card p-5">
            <h2 class="mb-2 text-sm font-semibold">Triage priority mix</h2>
            <apx-chart
              [series]="urgencySeries()"
              [chart]="donutChart()"
              [labels]="urgencyLabels()"
              [colors]="urgencyColors"
              [legend]="legend()"
              [dataLabels]="percentLabels"
              [stroke]="{ width: 0 }"
            />
          </div>

          <div class="card p-5">
            <h2 class="mb-2 text-sm font-semibold">Queue by status</h2>
            <apx-chart
              [series]="statusSeries()"
              [chart]="barChart()"
              [xaxis]="statusXAxis()"
              [colors]="statusColors"
              [plotOptions]="barPlot"
              [dataLabels]="barLabels()"
              [grid]="grid()"
              [legend]="{ show: false }"
            />
          </div>
        </div>

        <!-- Follow-ups due -->
        <div class="card p-5">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-semibold">Follow-ups due</h2>
            <span class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {{ k.completionRate }}% complete
            </span>
          </div>
          @if (store.analytics()?.followUpsDueList?.length) {
            <ul class="divide-y divide-slate-100 dark:divide-slate-800">
              @for (task of store.analytics()!.followUpsDueList; track task.id) {
                <li class="flex items-center justify-between gap-3 py-2.5">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium">{{ task.title }}</p>
                    <p class="truncate text-xs text-slate-500 dark:text-slate-400">{{ task.patientName }} · {{ task.owner }}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-2">
                    <span class="text-xs text-slate-500 dark:text-slate-400">{{ formatDate(task.dueDate) }}</span>
                    <span
                      class="chip"
                      [class]="task.status === 'done'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'"
                    >{{ task.status }}</span>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="py-6 text-center text-sm text-slate-400">No follow-ups due.</p>
          }
        </div>
      } @else if (store.error()) {
        <div class="card p-6 text-rose-600 dark:text-rose-300">{{ store.error() }}</div>
      } @else {
        <div class="grid place-items-center py-24 text-slate-400">Loading dashboard…</div>
      }
    </div>
  `,
})
export class DashboardComponent {
  protected readonly store = inject(CareIntakeStore);
  private readonly theme = inject(ThemeService);

  protected readonly kpis = computed(() => this.store.analytics()?.kpis ?? null);

  protected readonly cards = computed(() => {
    const k = this.kpis();
    if (!k) return [];
    return [
      { label: 'Open intakes', value: k.openIntakes, accent: 'text-indigo-600 dark:text-indigo-400' },
      { label: 'Urgent cases', value: k.urgentCases, accent: 'text-rose-600 dark:text-rose-400' },
      { label: 'Appts today', value: k.appointmentsToday, accent: '' },
      { label: 'This week', value: k.appointmentsThisWeek, accent: '' },
      { label: 'Avg triage score', value: k.avgTriageConfidence + '%', accent: 'text-emerald-600 dark:text-emerald-400' },
      { label: 'Follow-ups due', value: k.followUpsDue, accent: 'text-amber-600 dark:text-amber-400' },
    ];
  });

  // --- chart data ---
  protected readonly volumeSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Appointments', data: this.store.analytics()?.intakeVolume.map((p) => p.value) ?? [] },
  ]);
  protected readonly urgencySeries = computed<ApexNonAxisChartSeries>(
    () => this.store.analytics()?.queueByUrgency.map((u) => u.value) ?? [],
  );
  protected readonly urgencyLabels = computed(
    () => this.store.analytics()?.queueByUrgency.map((u) => titleCase(u.label)) ?? [],
  );
  protected readonly statusSeries = computed<ApexAxisChartSeries>(() => [
    { name: 'Appointments', data: this.store.analytics()?.queueByStatus.map((s) => s.value) ?? [] },
  ]);

  protected readonly urgencyColors = ['routine', 'soon', 'urgent'].map((u) => URGENCY_HEX[u]);
  protected readonly statusColors = ['scheduled', 'checked_in', 'triaged', 'follow_up'].map((s) => STATUS_HEX[s]);

  // --- theme-aware bits ---
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
  protected readonly barChart = computed<ApexChart>(() => ({
    type: 'bar',
    height: 300,
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
  protected readonly statusXAxis = computed<ApexXAxis>(() => ({
    categories: this.store.analytics()?.queueByStatus.map((s) => titleCase(s.label)) ?? [],
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
  protected readonly barPlot: ApexPlotOptions = {
    bar: { borderRadius: 8, distributed: true, columnWidth: '55%' },
  };
  protected readonly barLabels = computed<ApexDataLabels>(() => ({
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

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  }

  private shortDate(ymd: string): string {
    const [y, m, day] = ymd.split('-').map(Number);
    if (!y) return ymd;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, day));
  }
}
