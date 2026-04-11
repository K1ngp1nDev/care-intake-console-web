import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexXAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { CareIntakeStore } from './core/care-intake.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule, DatePipe],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  protected readonly store = inject(CareIntakeStore);
  protected readonly intakeStep = signal(1);

  protected readonly patientDraft = {
    fullName: 'Casey Monroe',
    dateOfBirth: '1992-03-17',
    phone: '+1 415 555 0199',
    email: 'casey.monroe@example.test',
  };

  protected readonly appointmentDraft = {
    scheduledFor: new Date(Date.now() + 6 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
    visitType: 'Nurse callback review',
    clinician: 'Dr. Shah',
    location: 'Virtual',
  };

  protected readonly intakeDraft = {
    symptoms: 'worsening cough, fatigue',
    notes: 'Persistent cough for a week with mild fever overnight.',
    duration: '7 days',
    allergies: 'none',
    medications: 'acetaminophen',
  };

  protected readonly statCards = computed(() => {
    const analytics = this.store.analytics();
    if (!analytics) {
      return [];
    }

    return [
      { label: 'Patients', value: analytics.totals.patients },
      { label: 'Appointments', value: analytics.totals.appointments },
      { label: 'Urgent cases', value: analytics.urgentCases },
      { label: 'Task completion', value: `${analytics.completionRate}%` },
    ];
  });

  protected readonly urgencySeries = computed<ApexNonAxisChartSeries>(() =>
    this.store.analytics()?.queueByUrgency.map((item) => item.value) ?? [0, 0, 0],
  );

  protected readonly urgencyLabels = computed(
    () => this.store.analytics()?.queueByUrgency.map((item) => item.label) ?? [],
  );

  protected readonly statusSeries = computed<ApexAxisChartSeries>(() => [
    {
      name: 'Queue load',
      data: this.store.analytics()?.queueByStatus.map((item) => item.value) ?? [],
    },
  ]);

  protected readonly statusLabels = computed(
    () => this.store.analytics()?.queueByStatus.map((item) => item.label) ?? [],
  );

  protected readonly donutChart: ApexChart = {
    type: 'donut',
    toolbar: { show: false },
  };

  protected readonly barChart: ApexChart = {
    type: 'bar',
    toolbar: { show: false },
  };

  protected readonly chartLegend: ApexLegend = {
    position: 'bottom',
    labels: { colors: '#ede6dc' },
  };

  protected readonly dataLabels: ApexDataLabels = {
    enabled: false,
  };

  protected readonly barXAxis: ApexXAxis = {
    categories: [],
    labels: {
      style: {
        colors: '#7d8ca2',
      },
    },
  };

  protected readonly barPlotOptions: ApexPlotOptions = {
    bar: {
      borderRadius: 8,
      horizontal: true,
    },
  };

  protected async createPatient() {
    await this.store.createPatient({ ...this.patientDraft });
  }

  protected async createAppointment() {
    const patient = this.store.selectedPatient();
    if (!patient) {
      return;
    }

    await this.store.createAppointment({
      patientId: patient.id,
      scheduledFor: new Date(this.appointmentDraft.scheduledFor).toISOString(),
      visitType: this.appointmentDraft.visitType,
      clinician: this.appointmentDraft.clinician,
      location: this.appointmentDraft.location,
    });
  }

  protected async submitIntake() {
    const patient = this.store.selectedPatient();
    const appointment = this.store.selectedPatientAppointments()[0];
    if (!patient || !appointment) {
      return;
    }

    const intake = await this.store.createIntake({
      patientId: patient.id,
      appointmentId: appointment.id,
      symptoms: this.intakeDraft.symptoms
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      notes: this.intakeDraft.notes,
      answers: {
        duration: this.intakeDraft.duration,
        allergies: this.intakeDraft.allergies,
        medications: this.intakeDraft.medications,
      },
    });

    await this.store.suggestTriage(intake.id);
  }

  protected async updateDecision(reviewStatus: 'accepted' | 'edited' | 'rejected') {
    const triage = this.store.selectedTriage();
    if (!triage) {
      return;
    }

    const clinicianSummary =
      reviewStatus === 'edited'
        ? window.prompt('Edited summary', triage.summary) ?? triage.summary
        : undefined;

    await this.store.updateTriageDecision(
      triage.id,
      reviewStatus,
      clinicianSummary,
    );
  }
}
