import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';
import { ShellComponent } from './features/shell/shell.component';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { QueueComponent } from './features/queue/queue.component';
import { PatientsComponent } from './features/patients/patients.component';
import { AppointmentsComponent } from './features/appointments/appointments.component';
import { TriageReviewComponent } from './features/triage/triage.component';
import { FollowupsComponent } from './features/followups/followups.component';
import { ReportsComponent } from './features/reports/reports.component';
import { AuditComponent } from './features/audit/audit.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'queue', component: QueueComponent },
      { path: 'patients', component: PatientsComponent },
      { path: 'appointments', component: AppointmentsComponent },
      { path: 'triage', component: TriageReviewComponent },
      { path: 'followups', component: FollowupsComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'audit', component: AuditComponent },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
