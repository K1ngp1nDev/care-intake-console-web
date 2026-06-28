import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CareIntakeStore } from '../../core/care-intake.store';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950">
      <!-- Desktop sidebar -->
      <aside
        class="hidden border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-900 lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col"
      >
        <div class="mb-8 flex items-center gap-3 px-2">
          <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">CI</div>
          <div>
            <p class="text-sm font-bold leading-tight">Care Intake</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Console</p>
          </div>
        </div>
        <nav class="flex flex-col gap-1">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
              class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {{ item.label }}
            </a>
          }
        </nav>
        <p class="mt-auto px-2 text-xs text-slate-400">Synthetic demo data only.</p>
      </aside>

      <div class="lg:pl-64">
        <!-- Top bar -->
        <header
          class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6"
        >
          <div class="flex items-center gap-2 lg:hidden">
            <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">CI</div>
            <span class="text-sm font-bold">Care Intake</span>
          </div>
          <div class="hidden text-sm font-semibold text-slate-500 dark:text-slate-400 lg:block">
            Outpatient intake &amp; triage operations
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="theme.toggle()"
              class="btn btn-outline !px-3 !py-2"
              [attr.aria-label]="theme.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
            >
              {{ theme.isDark() ? '☀︎' : '☾' }}
            </button>
            <span class="hidden text-sm font-medium text-slate-600 dark:text-slate-300 sm:block">
              {{ store.session()?.user?.name }}
            </span>
            <button type="button" class="btn btn-ghost !px-3 !py-2" (click)="logout()">Log out</button>
          </div>
        </header>

        <!-- Mobile nav -->
        <nav class="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          @for (item of nav; track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
              class="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300"
            >
              {{ item.label }}
            </a>
          }
        </nav>

        <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  protected readonly store = inject(CareIntakeStore);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly nav = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/queue', label: 'Queue' },
  ];

  protected logout() {
    this.store.logout();
    void this.router.navigate(['/login']);
  }
}
