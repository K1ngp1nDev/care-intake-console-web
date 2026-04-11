import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, forkJoin, map } from 'rxjs';
import {
  AppointmentRecord,
  FollowUpTaskRecord,
  IntakeRecord,
  PatientRecord,
  QueueSummary,
  ReviewStatus,
  SessionResponse,
  TriageSuggestionRecord,
} from './types';

type ApiEnvelope<T> = {
  data: T;
};

type QueueRow = {
  appointment: AppointmentRecord;
  patient: PatientRecord | undefined;
  triage: TriageSuggestionRecord | undefined;
};

@Injectable({ providedIn: 'root' })
export class CareIntakeStore {
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'http://127.0.0.1:3000';

  readonly session = signal<SessionResponse | null>(this.loadSession());
  readonly patients = signal<PatientRecord[]>([]);
  readonly appointments = signal<AppointmentRecord[]>([]);
  readonly triageSuggestions = signal<TriageSuggestionRecord[]>([]);
  readonly followUpTasks = signal<FollowUpTaskRecord[]>([]);
  readonly analytics = signal<QueueSummary | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedPatientId = signal<number | null>(null);
  readonly selectedTriageId = signal<number | null>(null);

  readonly queueRows = computed<QueueRow[]>(() =>
    this.appointments().map((appointment) => ({
      appointment,
      patient: this.patients().find((patient) => patient.id === appointment.patientId),
      triage: this.triageSuggestions().find(
        (triage) => triage.appointmentId === appointment.id,
      ),
    })),
  );

  readonly selectedPatient = computed(
    () =>
      this.patients().find((patient) => patient.id === this.selectedPatientId()) ??
      this.queueRows()[0]?.patient ??
      null,
  );

  readonly selectedTriage = computed(
    () =>
      this.triageSuggestions().find((triage) => triage.id === this.selectedTriageId()) ??
      this.triageSuggestions()[0] ??
      null,
  );

  readonly selectedPatientTasks = computed(() =>
    this.followUpTasks().filter(
      (task) => task.patientId === this.selectedPatient()?.id,
    ),
  );

  readonly selectedPatientAppointments = computed(() =>
    this.appointments().filter(
      (appointment) => appointment.patientId === this.selectedPatient()?.id,
    ),
  );

  constructor() {
    effect(() => {
      if (this.session()) {
        void this.refreshDashboard();
      }
    });
  }

  async loginDemo() {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        this.http.post<SessionResponse>(`${this.apiBase}/auth/login`, {
          email: 'demo@careintake.test',
          password: 'password',
          deviceName: 'care-intake-console-web',
        }),
      );

      this.session.set(response);
      window.localStorage.setItem(
        'care-intake-session',
        JSON.stringify(response),
      );
    } catch {
      this.error.set('Login failed. Check that the Nest API is running.');
    } finally {
      this.loading.set(false);
    }
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
    if (!this.session()) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(
        forkJoin({
          patients: this.http
            .get<ApiEnvelope<PatientRecord[]>>(`${this.apiBase}/patients`, {
              headers: this.authHeaders(),
            })
            .pipe(map((payload) => payload.data)),
          appointments: this.http
            .get<ApiEnvelope<AppointmentRecord[]>>(
              `${this.apiBase}/appointments`,
              {
                headers: this.authHeaders(),
              },
            )
            .pipe(map((payload) => payload.data)),
          triage: this.http
            .get<ApiEnvelope<TriageSuggestionRecord[]>>(`${this.apiBase}/triage`, {
              headers: this.authHeaders(),
            })
            .pipe(map((payload) => payload.data)),
          followUps: this.http
            .get<ApiEnvelope<FollowUpTaskRecord[]>>(
              `${this.apiBase}/followups`,
              {
                headers: this.authHeaders(),
              },
            )
            .pipe(map((payload) => payload.data)),
          analytics: this.http
            .get<ApiEnvelope<QueueSummary>>(
              `${this.apiBase}/analytics/queue-summary`,
              {
                headers: this.authHeaders(),
              },
            )
            .pipe(map((payload) => payload.data)),
        }),
      );

      this.patients.set(response.patients);
      this.appointments.set(response.appointments);
      this.triageSuggestions.set(response.triage);
      this.followUpTasks.set(response.followUps);
      this.analytics.set(response.analytics);

      if (!this.selectedPatientId() && response.patients[0]) {
        this.selectedPatientId.set(response.patients[0].id);
      }
      if (!this.selectedTriageId() && response.triage[0]) {
        this.selectedTriageId.set(response.triage[0].id);
      }
    } catch {
      this.error.set('Dashboard refresh failed.');
    } finally {
      this.loading.set(false);
    }
  }

  async createPatient(payload: {
    fullName: string;
    dateOfBirth: string;
    phone: string;
    email: string;
  }) {
    await firstValueFrom(
      this.http.post<ApiEnvelope<PatientRecord>>(
        `${this.apiBase}/patients`,
        payload,
        { headers: this.authHeaders() },
      ),
    );

    await this.refreshDashboard();
  }

  async createAppointment(payload: {
    patientId: number;
    scheduledFor: string;
    visitType: string;
    clinician: string;
    location: string;
  }) {
    await firstValueFrom(
      this.http.post<ApiEnvelope<AppointmentRecord>>(
        `${this.apiBase}/appointments`,
        payload,
        { headers: this.authHeaders() },
      ),
    );

    await this.refreshDashboard();
  }

  async createIntake(payload: {
    patientId: number;
    appointmentId: number;
    symptoms: string[];
    notes: string;
    answers: Record<string, string>;
  }) {
    const intake = await firstValueFrom(
      this.http.post<ApiEnvelope<IntakeRecord>>(`${this.apiBase}/intakes`, payload, {
        headers: this.authHeaders(),
      }),
    );

    return intake.data;
  }

  async suggestTriage(intakeId: number) {
    const response = await firstValueFrom(
      this.http.post<ApiEnvelope<TriageSuggestionRecord>>(
        `${this.apiBase}/triage/suggest`,
        { intakeId },
        { headers: this.authHeaders() },
      ),
    );

    this.selectedTriageId.set(response.data.id);
    await this.refreshDashboard();
    return response.data;
  }

  async updateTriageDecision(
    triageId: number,
    reviewStatus: ReviewStatus,
    clinicianSummary?: string,
  ) {
    await firstValueFrom(
      this.http.patch<ApiEnvelope<TriageSuggestionRecord>>(
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

  private authHeaders() {
    return new HttpHeaders({
      Authorization: `Bearer ${this.session()?.accessToken}`,
    });
  }

  private loadSession(): SessionResponse | null {
    const raw = window.localStorage.getItem('care-intake-session');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SessionResponse;
    } catch {
      return null;
    }
  }
}
