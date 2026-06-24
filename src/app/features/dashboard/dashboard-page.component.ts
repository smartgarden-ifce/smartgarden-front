import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { EMPTY, auditTime, catchError, exhaustMap, forkJoin, tap } from 'rxjs';

import { DashboardSummary, Device, DeviceLatestReadingSummary } from '../../core/models/smartgarden.models';
import { SmartgardenApiService } from '../../core/services/smartgarden-api.service';
import { ReadingEventsService } from '../../core/services/reading-events.service';

interface SelectOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, ButtonModule, MessageModule, SelectModule, SkeletonModule],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly api = inject(SmartgardenApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly readingEvents = inject(ReadingEventsService);

  readonly summary = signal<DashboardSummary | null>(null);
  readonly devices = signal<Device[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedHours = signal(24);
  readonly selectedDeviceCode = signal('');
  readonly hourOptions: SelectOption<number>[] = [6, 24, 72, 168].map((hours) => ({
    label: `${hours} horas`,
    value: hours
  }));

  readonly deviceOptions = computed<SelectOption<string>[]>(() => [
    { label: 'Todos os dispositivos', value: '' },
    ...this.devices().map((device) => ({ label: device.name, value: device.deviceCode }))
  ]);

  readonly primaryDeviceSummary = computed<DeviceLatestReadingSummary | null>(() => {
    const currentSummary = this.summary();
    if (!currentSummary) {
      return null;
    }
    const deviceCode = this.selectedDeviceCode();
    return deviceCode
      ? currentSummary.latestReadingsByDevice.find((device) => device.deviceCode === deviceCode) ?? null
      : currentSummary.latestReadingsByDevice[0] ?? null;
  });
  readonly latestReading = computed(() => this.primaryDeviceSummary()?.latestReading ?? null);
  readonly criteria = computed(() => this.summary()?.criteria ?? null);
  readonly activePercentage = computed(() => {
    const current = this.summary();
    return current?.totalDevices ? (current.activeDevices / current.totalDevices) * 100 : 0;
  });

  constructor() {
    this.loadInitialData();
    this.subscribeToReadingEvents();
  }

  onHoursChange(hours: number): void {
    this.selectedHours.set(Number(hours));
    this.loadSummary();
  }

  onDeviceChange(deviceCode: string): void {
    this.selectedDeviceCode.set(deviceCode);
  }

  refresh(): void {
    this.loadInitialData();
  }

  sensorConnectionLabel(active: boolean | null | undefined): string {
    return active ? 'Online' : 'Offline';
  }

  temperatureStatusLabel(temperatureC: number | null | undefined): string {
    const criteria = this.criteria();
    if (temperatureC == null) return 'Sem leitura';
    if (!criteria) return 'Critério indisponível';
    if (temperatureC > criteria.temperatureMaxC) return 'Ambiente quente';
    if (temperatureC < criteria.temperatureMinC) return 'Ambiente frio';
    return 'Temperatura agradável';
  }

  humidityStatusLabel(humidityPercent: number | null | undefined): string {
    const criteria = this.criteria();
    if (humidityPercent == null) return 'Sem leitura';
    if (!criteria) return 'Critério indisponível';
    if (humidityPercent < criteria.humidityMinPercent) return 'Umidade baixa';
    if (humidityPercent > criteria.humidityMaxPercent) return 'Umidade alta';
    return 'Umidade normal';
  }

  actionRecommendationLabel(): string {
    const reading = this.latestReading();
    const criteria = this.criteria();
    if (!reading) return 'Aguardando leitura';
    if (!criteria) return 'Critério indisponível';
    if (reading.temperatureC > criteria.temperatureMaxC && reading.humidityPercent < criteria.humidityMinPercent) return 'Sombrear e irrigar';
    if (reading.temperatureC > criteria.temperatureMaxC) return 'Reduzir calor';
    if (reading.humidityPercent < criteria.humidityMinPercent) return 'Verificar irrigação';
    if (reading.humidityPercent > criteria.humidityMaxPercent) return 'Aumentar ventilação';
    if (reading.temperatureC < criteria.temperatureMinC) return 'Monitorar frio';
    return 'Sem ação necessária';
  }

  temperatureToneClass(): string {
    const reading = this.latestReading();
    const criteria = this.criteria();
    if (!reading || !criteria) return 'tone-neutral';
    if (reading.temperatureC > criteria.temperatureMaxC) return 'tone-warm';
    if (reading.temperatureC < criteria.temperatureMinC) return 'tone-cool';
    return 'tone-adequate';
  }

  humidityToneClass(): string {
    const reading = this.latestReading();
    const criteria = this.criteria();
    if (!reading || !criteria) return 'tone-neutral';
    if (reading.humidityPercent > criteria.humidityMaxPercent) return 'tone-water';
    if (reading.humidityPercent < criteria.humidityMinPercent) return 'tone-dry';
    return 'tone-adequate';
  }

  lastUpdatedLabel(value: string | null | undefined): string {
    if (!value) return 'sem dados';
    const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.round(minutes / 60)}h`;
  }

  private loadInitialData(): void {
    this.fetchDashboardData(true).subscribe();
  }

  private fetchDashboardData(showLoading: boolean) {
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    return forkJoin({
      summary: this.api.getDashboardSummary(this.selectedHours()),
      devices: this.api.getDevices()
    }).pipe(
      tap(({ summary, devices }) => {
        this.summary.set(summary);
        this.devices.set(devices);
        this.loading.set(false);
      }),
      catchError((error) => {
        this.handleError(error);
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef)
    );
  }

  private subscribeToReadingEvents(): void {
    this.readingEvents.watch().pipe(
      auditTime(500),
      exhaustMap(() => this.fetchDashboardData(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
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
        error: (error) => this.handleError(error)
      });
  }

  private handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string') {
      this.errorMessage.set(error.error.message);
    } else if (error instanceof HttpErrorResponse) {
      this.errorMessage.set(`Falha ao carregar dados do backend (${error.status}).`);
    } else {
      this.errorMessage.set('Falha inesperada ao carregar os dados do SmartGarden.');
    }
    this.loading.set(false);
  }
}
