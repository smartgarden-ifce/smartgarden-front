import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { EMPTY, Subscription, auditTime, catchError, exhaustMap, forkJoin, tap } from 'rxjs';

import {
  Device,
  EnvironmentalCriteria,
  PageResponse,
  Reading,
  ReadingHistoryResponse
} from '../../core/models/smartgarden.models';
import { SmartgardenApiService } from '../../core/services/smartgarden-api.service';
import { ReadingEventsService } from '../../core/services/reading-events.service';

interface SelectOption<T> { label: string; value: T; }

@Component({
  selector: 'app-monitoring-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe, ButtonModule, MessageModule, SelectModule, SkeletonModule],
  templateUrl: './monitoring-page.component.html',
  styleUrl: './monitoring-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MonitoringPageComponent {
  private readonly api = inject(SmartgardenApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly readingEvents = inject(ReadingEventsService);
  private readonly pageSize = 20;
  private eventsSubscription?: Subscription;

  readonly devices = signal<Device[]>([]);
  readonly history = signal<ReadingHistoryResponse | null>(null);
  readonly readingsPage = signal<PageResponse<Reading> | null>(null);
  readonly criteria = signal<EnvironmentalCriteria | null>(null);
  readonly selectedDeviceCode = signal('');
  readonly selectedHours = signal(24);
  readonly loading = signal(true);
  readonly tableLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  private readonly appliedRange = signal<{ startAt: string; endAt: string } | null>(null);
  readonly hourOptions: SelectOption<number>[] = [6, 24, 72, 168].map((hours) => ({ label: `${hours} horas`, value: hours }));
  readonly deviceOptions = computed<SelectOption<string>[]>(() => this.devices().map((device) => ({ label: device.name, value: device.deviceCode })));
  readonly chartReadings = computed(() => this.history()?.readings ?? []);
  readonly latestReading = computed(() => this.chartReadings().at(-1) ?? null);
  readonly chartReady = computed(() => this.chartReadings().length >= 2);
  readonly temperaturePoints = computed(() => this.buildChartPoints(this.chartReadings(), 'temperatureC'));
  readonly humidityPoints = computed(() => this.buildChartPoints(this.chartReadings(), 'humidityPercent'));
  readonly timelineLabels = computed(() => {
    const readings = this.chartReadings();
    if (!readings.length) return ['--', '--', '--'];
    return [readings[0], readings[Math.floor(readings.length / 2)], readings.at(-1)]
      .map((reading) => this.formatChartDate(reading?.recordedAt));
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.eventsSubscription?.unsubscribe());
    this.loadDevices();
  }

  onDeviceChange(deviceCode: string): void {
    this.selectedDeviceCode.set(deviceCode);
    this.loadMonitoringData();
    this.subscribeToReadingEvents();
  }

  onHoursChange(hours: number): void {
    this.selectedHours.set(Number(hours));
    this.loadMonitoringData();
  }

  refresh(): void {
    this.loadMonitoringData();
  }

  goToPreviousPage(): void {
    const page = this.readingsPage();
    if (page && !page.first) this.loadReadingsPage(page.page - 1);
  }

  goToNextPage(): void {
    const page = this.readingsPage();
    if (page && !page.last) this.loadReadingsPage(page.page + 1);
  }

  temperatureStatus(value: number): string {
    const criteria = this.criteria();
    if (!criteria) return 'Indisponível';
    if (value < criteria.temperatureMinC) return 'Frio';
    if (value > criteria.temperatureMaxC) return 'Quente';
    return 'Agradável';
  }

  humidityStatus(value: number): string {
    const criteria = this.criteria();
    if (!criteria) return 'Indisponível';
    if (value < criteria.humidityMinPercent) return 'Baixa';
    if (value > criteria.humidityMaxPercent) return 'Alta';
    return 'Normal';
  }

  readingStatusClass(reading: Reading): string {
    const criteria = this.criteria();
    if (!criteria) return '';
    const adequate = reading.temperatureC >= criteria.temperatureMinC
      && reading.temperatureC <= criteria.temperatureMaxC
      && reading.humidityPercent >= criteria.humidityMinPercent
      && reading.humidityPercent <= criteria.humidityMaxPercent;
    return adequate ? 'is-adequate' : 'is-exception';
  }

  private loadDevices(): void {
    this.loading.set(true);
    this.api.getDevices().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (devices) => {
        this.devices.set(devices);
        if (!devices.length) {
          this.loading.set(false);
          return;
        }
        this.selectedDeviceCode.set(devices[0].deviceCode);
        this.loadMonitoringData();
        this.subscribeToReadingEvents();
      },
      error: (error) => this.handleError(error)
    });
  }

  private loadMonitoringData(): void {
    this.fetchMonitoringData(true).subscribe();
  }

  private fetchMonitoringData(showLoading: boolean) {
    const deviceCode = this.selectedDeviceCode();
    if (!deviceCode) return EMPTY;
    if (showLoading) this.loading.set(true);
    this.errorMessage.set(null);
    const range = this.currentRange();
    this.appliedRange.set(range);
    return forkJoin({
      history: this.api.getReadingHistory(deviceCode, this.selectedHours(), 120, range.startAt, range.endAt),
      readings: this.api.getReadings({ deviceCode, page: 0, size: this.pageSize, ...range }),
      summary: this.api.getDashboardSummary(this.selectedHours())
    }).pipe(
      tap(({ history, readings, summary }) => {
        this.history.set(history);
        this.readingsPage.set(readings);
        this.criteria.set(summary.criteria);
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
    this.eventsSubscription?.unsubscribe();
    const deviceCode = this.selectedDeviceCode();
    if (!deviceCode) return;
    this.eventsSubscription = this.readingEvents.watch(deviceCode).pipe(
      auditTime(500),
      exhaustMap(() => this.fetchMonitoringData(false))
    ).subscribe();
  }

  private loadReadingsPage(page: number): void {
    this.tableLoading.set(true);
    this.errorMessage.set(null);
    const range = this.appliedRange() ?? this.currentRange();
    this.api.getReadings({
      deviceCode: this.selectedDeviceCode(),
      page,
      size: this.pageSize,
      ...range
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (readings) => {
        this.readingsPage.set(readings);
        this.tableLoading.set(false);
      },
      error: (error) => {
        this.tableLoading.set(false);
        this.handleError(error, false);
      }
    });
  }

  private currentRange(): { startAt: string; endAt: string } {
    const end = new Date();
    const start = new Date(end.getTime() - this.selectedHours() * 60 * 60 * 1000);
    return { startAt: start.toISOString(), endAt: end.toISOString() };
  }

  private buildChartPoints(readings: Reading[], field: 'temperatureC' | 'humidityPercent'): string {
    if (!readings.length) return '';
    const values = readings.map((reading) => reading[field]);
    const min = Math.min(...values);
    const range = Math.max(Math.max(...values) - min, 1);
    return values.map((value, index) => {
      const x = values.length === 1 ? 160 : 12 + (index / (values.length - 1)) * 296;
      const y = 108 - ((value - min) / range) * 82;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  }

  private formatChartDate(value: string | undefined): string {
    if (!value) return '--';
    const options: Intl.DateTimeFormatOptions = this.selectedHours() > 24
      ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
      : { hour: '2-digit', minute: '2-digit' };
    return new Intl.DateTimeFormat('pt-BR', options).format(new Date(value));
  }

  private handleError(error: unknown, stopLoading = true): void {
    const backendMessage = error instanceof HttpErrorResponse && typeof error.error?.message === 'string' ? error.error.message : null;
    this.errorMessage.set(backendMessage ?? (error instanceof HttpErrorResponse
      ? `Falha ao carregar o monitoramento (${error.status}).`
      : 'Falha inesperada ao carregar o monitoramento.'));
    if (stopLoading) this.loading.set(false);
  }
}
