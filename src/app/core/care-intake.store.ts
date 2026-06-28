import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map } from 'rxjs';
import {
  Analytics,
  AppointmentRecord,
  AppointmentStatus,
  FollowUpTaskRecord,
  PatientRecord,
  ReviewStatus,
  SessionResponse,
  TriageSuggestionRecord,
  Urgency,
} from './types';

type ApiEnvelope<T> = { data: T };

export interface QueueRow {
  appointment: AppointmentRecord;
  patient: PatientRecord | undefined;
  triage: TriageSuggestionRecord | undefined;
}

export const DEMO_CREDENTIALS = { email: 'demo@example.com', password: 'demo12345' };

@Injectable({ providedIn: 'root' })
export class CareIntakeStore {
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'http://127.0.0.1:3000';

  readonly session = signal<SessionResponse | null>(this.loadSession());
  readonly patients = signal<PatientRecord[]>([]);
  readonly appointments = signal<AppointmentRecord[]>([]);
  readonly triageSuggestions = signal<TriageSuggestionRecord[]>([]);
  readonly followUpTasks = signal<FollowUpTaskRecord[]>([]);
  readonly analytics = signal<Analytics | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // Queue filters
  readonly queueSearch = signal('');
  readonly queueStatus = signal<'all' | AppointmentStatus>('all');
  readonly queueUrgency = signal<'all' | Urgency>('all');
  readonly selectedAppointmentId = signal<number | null>(null);

  readonly queueRows = computed<QueueRow[]>(() =>
    this.appointments().map((appointment) => ({
      appointment,
      patient: this.patients().find((patient) => patient.id === appointment.patientId),
      triage: this.triageSuggestions().find(
        (triage) => triage.appointmentId === appointment.id,
      ),
    })),
  );

  readonly filteredQueueRows = computed<QueueRow[]>(() => {
    const query = this.queueSearch().trim().toLowerCase();
    const status = this.queueStatus();
    const urgency = this.queueUrgency();
    return this.queueRows().filter((row) => {
      if (status !== 'all' && row.appointment.status !== status) return false;
      if (urgency !== 'all' && row.appointment.urgency !== urgency) return false;
      if (!query) return true;
      const haystack = `${row.patient?.fullName ?? ''} ${row.appointment.visitType} ${row.appointment.clinician}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  readonly selectedRow = computed<QueueRow | null>(() => {
    const id = this.selectedAppointmentId();
    const rows = this.filteredQueueRows();
    return rows.find((row) => row.appointment.id === id) ?? rows[0] ?? null;
  });

  readonly selectedPatientTasks = computed(() =>
    this.followUpTasks().filter(
      (task) => task.patientId === this.selectedRow()?.patient?.id,
    ),
  );

  constructor() {
    effect(
      () => {
        if (this.session()) {
          void this.refreshDashboard();
        }
      },
      { allowSignalWrites: true },
    );
  }

  async login(email: string, password: string) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<SessionResponse>(`${this.apiBase}/auth/login`, {
          email,
          password,
        }),
      );
      this.session.set(response);
      window.localStorage.setItem('care-intake-session', JSON.stringify(response));
      return true;
    } catch {
      this.error.set('Login failed. Check that the API is running on port 3000.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  loginDemo() {
    return this.login(DEMO_CREDENTIALS.email, DEMO_CREDENTIALS.password);
  }

  logout() {
    this.session.set(null);
    this.patients.set([]);
    this.appointments.set([]);
    this.triageSuggestions.set([]);
    this.followUpTasks.set([]);
    this.analytics.set(null);
    window.localStorage.removeItem('care-intake-session');
  }

  async refreshDashboard() {
    if (!this.session()) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        forkJoin({
          patients: this.get<PatientRecord[]>('/patients'),
          appointments: this.get<AppointmentRecord[]>('/appointments'),
          triage: this.get<TriageSuggestionRecord[]>('/triage'),
          followUps: this.get<FollowUpTaskRecord[]>('/followups'),
          analytics: this.get<Analytics>('/analytics/queue-summary'),
        }),
      );
      this.patients.set(response.patients);
      this.appointments.set(response.appointments);
      this.triageSuggestions.set(response.triage);
      this.followUpTasks.set(response.followUps);
      this.analytics.set(response.analytics);
      if (this.selectedAppointmentId() === null && response.appointments[0]) {
        this.selectedAppointmentId.set(response.appointments[0].id);
      }
    } catch {
      this.error.set('Dashboard refresh failed.');
    } finally {
      this.loading.set(false);
    }
  }

  async updateTriageDecision(
    triageId: number,
    reviewStatus: ReviewStatus,
    clinicianSummary?: string,
  ) {
    await firstValueFrom(
      this.http.patch(
        `${this.apiBase}/triage/${triageId}/decision`,
        { reviewStatus, clinicianSummary },
        { headers: this.authHeaders() },
      ),
    );
    await this.refreshDashboard();
  }

  async generateFollowUps(triageId: number) {
    await firstValueFrom(
      this.http.post(
        `${this.apiBase}/followups/generate`,
        { triageId },
        { headers: this.authHeaders() },
      ),
    );
    await this.refreshDashboard();
  }

  private get<T>(path: string) {
    return this.http
      .get<ApiEnvelope<T>>(`${this.apiBase}${path}`, { headers: this.authHeaders() })
      .pipe(map((payload) => payload.data));
  }

  private authHeaders() {
    return new HttpHeaders({
      Authorization: `Bearer ${this.session()?.accessToken}`,
    });
  }

  private loadSession(): SessionResponse | null {
    const raw = window.localStorage.getItem('care-intake-session');
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionResponse;
    } catch {
      return null;
    }
  }
}
