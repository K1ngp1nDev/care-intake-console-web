import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CareIntakeStore, DEMO_CREDENTIALS } from '../../core/care-intake.store';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      <div class="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl"></div>
      <div class="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"></div>

      <button
        type="button"
        (click)="theme.toggle()"
        class="btn btn-outline absolute right-4 top-4 !px-3 !py-2"
        [attr.aria-label]="theme.isDark() ? 'Switch to light theme' : 'Switch to dark theme'"
      >
        {{ theme.isDark() ? '☀︎' : '☾' }}
      </button>

      <div class="card relative w-full max-w-md p-8">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white">CI</div>
          <div>
            <h1 class="text-lg font-bold leading-tight">Care Intake Console</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400">Outpatient intake &amp; triage operations</p>
          </div>
        </div>

        <p class="mb-6 text-sm text-slate-500 dark:text-slate-400">
          Sign in to the operations workspace. This is a synthetic demo — no real patient data.
        </p>

        <form (ngSubmit)="submit()" class="space-y-4">
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Email</span>
            <input class="field" type="email" name="email" [(ngModel)]="email" autocomplete="username" required />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">Password</span>
            <input class="field" type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
          </label>

          @if (store.error()) {
            <p class="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              {{ store.error() }}
            </p>
          }

          <button type="submit" class="btn btn-primary w-full" [disabled]="store.loading()">
            {{ store.loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <div class="mt-5 rounded-xl border border-dashed border-slate-300 p-3 text-sm dark:border-slate-700">
          <div class="mb-1 flex items-center justify-between">
            <span class="font-semibold text-slate-600 dark:text-slate-300">Demo account</span>
            <button type="button" class="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400" (click)="fillDemo()">
              Autofill
            </button>
          </div>
          <p class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ demo.email }}</p>
          <p class="font-mono text-xs text-slate-500 dark:text-slate-400">{{ demo.password }}</p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  protected readonly store = inject(CareIntakeStore);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);

  protected readonly demo = DEMO_CREDENTIALS;
  protected email = DEMO_CREDENTIALS.email;
  protected password = DEMO_CREDENTIALS.password;

  protected fillDemo() {
    this.email = this.demo.email;
    this.password = this.demo.password;
  }

  protected async submit() {
    const ok = await this.store.login(this.email, this.password);
    if (ok) {
      void this.router.navigate(['/dashboard']);
    }
  }
}
