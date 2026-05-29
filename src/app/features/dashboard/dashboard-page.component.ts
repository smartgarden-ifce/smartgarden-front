import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { forkJoin } from 'rxjs';

import {
  DashboardAlert,
  DashboardSummary,
  Device,
  DeviceLatestReadingSummary,
  PageResponse,
  Reading,
  ReadingHistory
} from '../../core/models/smartgarden.models';
import { SmartgardenApiService } from '../../core/services/smartgarden-api.service';

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DatePipe,
    DecimalPipe,
    ButtonModule,
    MessageModule,
    SelectModule,
    SkeletonModule
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly api = inject(SmartgardenApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly hoursOptions = [6, 24, 72, 168];
  readonly pageSize = 10;

  readonly summary = signal<DashboardSummary | null>(null);
  readonly devices = signal<Device[]>([]);
  readonly readingsPage = signal<PageResponse<Reading> | null>(null);
  readonly history = signal<ReadingHistory | null>(null);
  readonly loading = signal(true);
  readonly readingsLoading = signal(false);
  readonly historyLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedHours = signal(24);
  readonly selectedDeviceCode = signal('');
  readonly hourOptions: SelectOption<number>[] = this.hoursOptions.map((hours) => ({
    label: `${hours} horas`,
    value: hours
  }));

  readonly deviceOptions = computed<SelectOption<string>[]>(() => [
    { label: 'Todos', value: '' },
    ...this.devices().map((device) => ({
      label: device.name,
      value: device.deviceCode
    }))
  ]);

  readonly primaryDeviceSummary = computed<DeviceLatestReadingSummary | null>(() => {
    const currentSummary = this.summary();
    if (!currentSummary) {
      return null;
    }

    const selectedDeviceCode = this.selectedDeviceCode();
    if (selectedDeviceCode) {
      return currentSummary.latestReadingsByDevice.find((device) => device.deviceCode === selectedDeviceCode) ?? null;
    }

    return currentSummary.latestReadingsByDevice[0] ?? null;
  });

  readonly latestReading = computed<Reading | null>(() => this.primaryDeviceSummary()?.latestReading ?? null);

  readonly alerts = computed<DashboardAlert[]>(() => this.summary()?.alerts ?? []);
  readonly recentReadings = computed<Reading[]>(() => this.readingsPage()?.content ?? []);

  readonly historicalReadings = computed<Reading[]>(() => this.history()?.readings ?? []);

  readonly temperatureChartPoints = computed(() => this.buildChartPoints(this.historicalReadings(), 'temperatureC'));
  readonly humidityChartPoints = computed(() => this.buildChartPoints(this.historicalReadings(), 'humidityPercent'));
  readonly chartReady = computed(() => this.historicalReadings().length >= 2);
  readonly chartLabels = computed(() => {
    const readings = this.historicalReadings();
    if (readings.length === 0) {
      return ['--:--', '--:--', '--:--'];
    }

    const first = readings[0]?.recordedAt;
    const middle = readings[Math.floor(readings.length / 2)]?.recordedAt;
    const last = readings[readings.length - 1]?.recordedAt;

    return [first, middle, last].map((value) => this.formatChartTime(value));
  });

  readonly activePercentage = computed(() => {
    const currentSummary = this.summary();
    if (!currentSummary || currentSummary.totalDevices === 0) {
      return 0;
    }

    return (currentSummary.activeDevices / currentSummary.totalDevices) * 100;
  });

  constructor() {
    this.loadInitialData();
  }

  onHoursChange(hours: number): void {
    this.selectedHours.set(Number(hours));
    this.loadSummary();
    this.loadHistory();
  }

  onDeviceFilterChange(deviceCode: string): void {
    this.selectedDeviceCode.set(deviceCode);
    this.loadReadings(0);
    this.loadHistory();
  }

  goToPreviousPage(): void {
    const currentPage = this.readingsPage();
    if (!currentPage || currentPage.first) {
      return;
    }

    this.loadReadings(currentPage.page - 1);
  }

  goToNextPage(): void {
    const currentPage = this.readingsPage();
    if (!currentPage || currentPage.last) {
      return;
    }

    this.loadReadings(currentPage.page + 1);
  }

  refresh(): void {
    this.loadInitialData();
  }

  alertSeverityClass(severity: DashboardAlert['severity']): string {
    switch (severity) {
      case 'critical':
        return 'alert-critical';
      case 'warning':
        return 'alert-warning';
      default:
        return 'alert-info';
    }
  }

  temperatureStatusLabel(temperatureC: number | null | undefined): string {
    if (temperatureC == null) {
      return 'Sem leitura';
    }

    if (temperatureC >= 30) {
      return 'Ambiente quente';
    }

    if (temperatureC <= 20) {
      return 'Ambiente frio';
    }

    return 'Ambiente estável';
  }

  humidityStatusLabel(humidityPercent: number | null | undefined): string {
    if (humidityPercent == null) {
      return 'Umidade indisponível';
    }

    if (humidityPercent < 40) {
      return 'Umidade baixa';
    }

    if (humidityPercent > 70) {
      return 'Umidade alta';
    }

    return 'Umidade normal';
  }

  combinedReadingStatus(reading: Reading): string {
    return `${this.temperatureStatusLabel(reading.temperatureC)} / ${this.humidityStatusLabel(reading.humidityPercent)}`;
  }

  sensorConnectionLabel(active: boolean | null | undefined): string {
    return active ? 'Online' : 'Offline';
  }

  environmentToneClass(): string {
    const latest = this.latestReading();
    if (!latest) {
      return 'tone-neutral';
    }

    if (latest.temperatureC >= 30) {
      return 'tone-warm';
    }

    if (latest.temperatureC <= 20) {
      return 'tone-cool';
    }

    return 'tone-stable';
  }

  humidityToneClass(): string {
    const latest = this.latestReading();
    if (!latest) {
      return 'tone-neutral';
    }

    if (latest.humidityPercent > 70) {
      return 'tone-water';
    }

    if (latest.humidityPercent < 40) {
      return 'tone-dry';
    }

    return 'tone-stable';
  }

  sensorToneClass(): string {
    return this.primaryDeviceSummary()?.active ? 'tone-online' : 'tone-offline';
  }

  lastUpdatedLabel(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return 'sem dados';
    }

    const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(dateValue).getTime()) / 1000));
    if (diffSeconds < 60) {
      return `${diffSeconds}s`;
    }

    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) {
      return `${diffMinutes} min`;
    }

    const diffHours = Math.round(diffMinutes / 60);
    return `${diffHours}h`;
  }

  tableStatusClass(reading: Reading): string {
    if (reading.temperatureC >= 30 || reading.humidityPercent > 70) {
      return 'is-warm';
    }

    if (reading.humidityPercent < 40) {
      return 'is-dry';
    }

    return 'is-normal';
  }

  trackByReadingId(_: number, reading: Reading): number {
    return reading.id;
  }

  private formatChartTime(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return '--:--';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateValue));
  }

  private buildChartPoints(readings: Reading[], field: 'temperatureC' | 'humidityPercent'): string {
    if (readings.length === 0) {
      return '';
    }

    const values = readings.map((reading) => reading[field]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);

    return values.map((value, index) => {
      const x = readings.length === 1 ? 160 : (index / (readings.length - 1)) * 320;
      const y = 110 - ((value - min) / range) * 70;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }

  private loadInitialData(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      summary: this.api.getDashboardSummary(this.selectedHours()),
      devices: this.api.getDevices(),
      readings: this.api.getReadings({
        page: 0,
        size: this.pageSize,
        deviceCode: this.selectedDeviceCode() || undefined
      })
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ summary, devices, readings }) => {
          this.summary.set(summary);
          this.devices.set(devices);
          this.readingsPage.set(readings);
          this.loading.set(false);
          this.loadHistory();
        },
        error: (error) => {
          this.errorMessage.set(this.toErrorMessage(error));
          this.loading.set(false);
        }
      });
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.getDashboardSummary(this.selectedHours())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(this.toErrorMessage(error));
          this.loading.set(false);
        }
      });
  }

  private loadReadings(page: number): void {
    this.readingsLoading.set(true);
    this.errorMessage.set(null);

    this.api.getReadings({
      page,
      size: this.pageSize,
      deviceCode: this.selectedDeviceCode() || undefined
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (readings) => {
          this.readingsPage.set(readings);
          this.readingsLoading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(this.toErrorMessage(error));
          this.readingsLoading.set(false);
        }
      });
  }

  private loadHistory(): void {
    const deviceCode = this.selectedDeviceCode() || this.summary()?.latestReadingsByDevice[0]?.deviceCode;
    if (!deviceCode) {
      this.history.set(null);
      return;
    }

    this.historyLoading.set(true);
    this.api.getReadingHistory({
      deviceCode,
      hours: this.selectedHours(),
      limit: 120
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          this.history.set(history);
          this.historyLoading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(this.toErrorMessage(error));
          this.historyLoading.set(false);
        }
      });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') {
        return error.error.message;
      }

      if (Array.isArray(error.error?.messages) && error.error.messages.length > 0) {
        return error.error.messages.join(' | ');
      }

      return `Falha ao carregar dados do backend (${error.status}).`;
    }

    return 'Falha inesperada ao carregar os dados do SmartGarden.';
  }
}
