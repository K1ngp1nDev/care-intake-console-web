export type ReviewStatus = 'pending' | 'accepted' | 'edited' | 'rejected';
export type Urgency = 'routine' | 'soon' | 'urgent';
export type AppointmentStatus = 'scheduled' | 'checked_in' | 'triaged' | 'follow_up';

export interface PatientRecord {
  id: number;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  email: string;
  tags: string[];
  createdAt: string;
}

export interface AppointmentRecord {
  id: number;
  patientId: number;
  scheduledFor: string;
  visitType: string;
  clinician: string;
  location: string;
  status: AppointmentStatus;
  urgency: Urgency;
  createdAt: string;
}

export interface IntakeRecord {
  id: number;
  patientId: number;
  appointmentId: number;
  symptoms: string[];
  notes: string;
  answers: Record<string, string>;
  createdAt: string;
}

export interface TriageSuggestionRecord {
  id: number;
  patientId: number;
  appointmentId: number;
  intakeId: number;
  urgency: Urgency;
  summary: string;
  reasoningSnippet: string;
  confidence: number;
  sourceRefs: Array<{ id: string; label: string }>;
  reviewStatus: ReviewStatus;
  missingInfoChecklist: string[];
  followUpQuestions: string[];
  visitPrepChecklist: string[];
  clinicianSummary?: string;
  clinicianNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FollowUpTaskRecord {
  id: number;
  patientId: number;
  appointmentId: number;
  triageId: number;
  title: string;
  dueDate: string;
  status: 'todo' | 'done';
  owner: string;
}

export interface AnalyticsKpis {
  openIntakes: number;
  urgentCases: number;
  appointmentsToday: number;
  appointmentsThisWeek: number;
  avgTriageConfidence: number;
  followUpsDue: number;
  completionRate: number;
}

export interface IntakeVolumePoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface FollowUpDueItem {
  id: number;
  title: string;
  patientName: string;
  dueDate: string;
  owner: string;
  status: 'todo' | 'done';
}

export interface Analytics {
  totals: {
    patients: number;
    appointments: number;
    intakes: number;
    triageSuggestions: number;
    followUpTasks: number;
  };
  kpis: AnalyticsKpis;
  queueByStatus: Array<{ label: string; value: number }>;
  queueByUrgency: Array<{ label: string; value: number }>;
  intakeVolume: IntakeVolumePoint[];
  followUpsDueList: FollowUpDueItem[];
}

export interface SessionResponse {
  accessToken: string;
  user: {
    id: number;
    email: string;
    name: string;
  };
  demoHints: {
    email: string;
    password: string;
  };
}

export interface AuditEvent {
  id: string;
  type: 'patient' | 'appointment' | 'intake' | 'triage' | 'followup';
  title: string;
  detail: string;
  severity: 'info' | 'success' | 'warning';
  at: string;
}
