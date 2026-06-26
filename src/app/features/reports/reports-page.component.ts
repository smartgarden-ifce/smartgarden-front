import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { firstValueFrom, forkJoin } from 'rxjs';
import type { jsPDF as JsPdfDocument } from 'jspdf';

import {
  Device,
  EnvironmentalCriteria,
  EnvironmentalReport,
  PageResponse,
  Reading
} from '../../core/models/smartgarden.models';
import { SmartgardenApiService } from '../../core/services/smartgarden-api.service';

interface DeviceOption {
  label: string;
  value: string;
}

interface AppliedReportFilters {
  deviceCode: string;
  startAt: string;
  endAt: string;
}

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe, ButtonModule, DatePickerModule, MessageModule, SelectModule],
  templateUrl: './reports-page.component.html',
  styleUrls: ['./reports-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsPageComponent {
  private readonly api = inject(SmartgardenApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pageSize = 20;

  readonly devices = signal<Device[]>([]);
  readonly report = signal<EnvironmentalReport | null>(null);
  readonly readingsPage = signal<PageResponse<Reading> | null>(null);
  readonly loading = signal(true);
  readonly readingsLoading = signal(false);
  readonly pdfGenerating = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedDeviceCode = signal('');
  readonly startAt = signal<Date | null>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  readonly endAt = signal<Date | null>(new Date());
  readonly today = new Date();
  private readonly appliedFilters = signal<AppliedReportFilters | null>(null);

  readonly deviceOptions = computed<DeviceOption[]>(() => this.devices().map((device) => ({
    label: device.name,
    value: device.deviceCode
  })));
  readonly diagnosis = computed(() => {
    const summary = this.report()?.summary;
    if (!summary || summary.totalReadings === 0 || summary.adequatePercentage == null) {
      return 'Não há leituras suficientes para diagnosticar o período.';
    }
    if (summary.adequatePercentage >= 90) {
      return 'As condições permaneceram predominantemente dentro das faixas adequadas.';
    }
    if (summary.adequatePercentage >= 60) {
      return 'O período apresentou oscilações; consulte as exceções para identificar os horários críticos.';
    }
    return 'A maior parte das leituras ficou fora das faixas; recomenda-se revisar as condições do local.';
  });

  constructor() {
    this.loadInitialData();
  }

  onDeviceChange(deviceCode: string): void {
    this.selectedDeviceCode.set(deviceCode);
  }

  onStartChange(value: Date | null): void {
    this.startAt.set(value);
  }

  onEndChange(value: Date | null): void {
    this.endAt.set(value);
  }

  generateReport(): void {
    const rangeError = this.validateRange();
    if (rangeError) {
      this.errorMessage.set(rangeError);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    const deviceCode = this.selectedDeviceCode();
    const startAt = this.toOffsetIso(this.startAt()!, false);
    const endAt = this.toOffsetIso(this.endAt()!, true);
    forkJoin({
      report: this.api.getEnvironmentalReport(deviceCode, startAt, endAt),
      readings: this.api.getReadings({
        deviceCode,
        page: 0,
        size: this.pageSize,
        startAt,
        endAt
      })
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ report, readings }) => {
          this.report.set(report);
          this.readingsPage.set(readings);
          this.appliedFilters.set({ deviceCode, startAt, endAt });
          this.loading.set(false);
        },
        error: (error) => {
          this.errorMessage.set(this.toErrorMessage(error));
          this.loading.set(false);
        }
      });
  }

  goToPreviousPage(): void {
    const page = this.readingsPage();
    if (page && !page.first) {
      this.loadReadings(page.page - 1);
    }
  }

  goToNextPage(): void {
    const page = this.readingsPage();
    if (page && !page.last) {
      this.loadReadings(page.page + 1);
    }
  }

  async downloadPdf(): Promise<void> {
    const report = this.report();
    if (!report || this.pdfGenerating()) {
      return;
    }

    this.pdfGenerating.set(true);
    this.errorMessage.set(null);
    try {
      const filters = this.appliedFilters();
      if (!filters) {
        throw new Error('Filtros do relatório não encontrados.');
      }
      const [readings, [{ jsPDF }, { default: autoTable }]] = await Promise.all([
        firstValueFrom(this.api.getAllReadings(filters)),
        Promise.all([import('jspdf'), import('jspdf-autotable')])
      ]);
      const document = new jsPDF({ unit: 'mm', format: 'a4' });
      this.drawPdfHeader(document, report);
      let cursorY = this.drawPdfSummary(document, report);
      cursorY = this.drawPdfCriteria(document, report, cursorY);

      if (report.exceptions.length > 0) {
        autoTable(document, {
          startY: cursorY,
          head: [['Data e hora', 'Temperatura', 'Umidade', 'Diagnóstico']],
          body: report.exceptions.map((exception) => [
            this.formatDateTime(exception.recordedAt),
            `${exception.temperatureC.toFixed(1)} °C`,
            `${exception.humidityPercent.toFixed(1)} %`,
            `${exception.temperatureStatus} / ${exception.humidityStatus}`
          ]),
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.2 },
          headStyles: { fillColor: [45, 106, 79], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 245, 238] },
          margin: { left: 14, right: 14 },
          didDrawPage: () => this.drawPdfFooter(document)
        });
      } else {
        document.setFontSize(9);
        document.setTextColor(99, 113, 100);
        document.text('Nenhuma exceção encontrada no período.', 14, cursorY + 8);
        this.drawPdfFooter(document);
      }

      document.addPage();
      document.setFontSize(12);
      document.setFont('helvetica', 'bold');
      document.setTextColor(31, 44, 31);
      document.text(`Histórico completo (${readings.length} leituras)`, 14, 18);
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.setTextColor(99, 113, 100);
      document.text('Registros ordenados do mais recente para o mais antigo.', 14, 23);

      if (readings.length > 0) {
        autoTable(document, {
          startY: 27,
          head: [['Data e hora', 'Temperatura', 'Umidade', 'Status']],
          body: readings.map((reading) => [
            this.formatDateTime(reading.recordedAt),
            `${reading.temperatureC.toFixed(1)} °C`,
            `${reading.humidityPercent.toFixed(1)} %`,
            `${this.temperatureStatus(reading.temperatureC, report.criteria)} / ${this.humidityStatus(reading.humidityPercent, report.criteria)}`
          ]),
          theme: 'grid',
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          headStyles: { fillColor: [45, 106, 79], textColor: 255 },
          alternateRowStyles: { fillColor: [248, 245, 238] },
          margin: { left: 14, right: 14, bottom: 12 },
          didDrawPage: () => this.drawPdfFooter(document)
        });
      } else {
        document.setFontSize(9);
        document.text('Nenhuma leitura encontrada no período.', 14, 32);
        this.drawPdfFooter(document);
      }

      const safeDeviceCode = report.deviceCode.replace(/[^a-zA-Z0-9_-]/g, '-');
      const date = new Date().toISOString().slice(0, 10);
      document.save(`smartgarden-${safeDeviceCode}-${date}.pdf`);
    } catch {
      this.errorMessage.set('Não foi possível gerar o arquivo PDF. Tente novamente.');
    } finally {
      this.pdfGenerating.set(false);
    }
  }

  temperatureStatus(temperatureC: number, criteria: EnvironmentalCriteria): string {
    if (temperatureC < criteria.temperatureMinC) {
      return 'Temperatura fria';
    }
    if (temperatureC > criteria.temperatureMaxC) {
      return 'Temperatura quente';
    }
    return 'Temperatura agradável';
  }

  humidityStatus(humidityPercent: number, criteria: EnvironmentalCriteria): string {
    if (humidityPercent < criteria.humidityMinPercent) {
      return 'Umidade baixa';
    }
    if (humidityPercent > criteria.humidityMaxPercent) {
      return 'Umidade alta';
    }
    return 'Umidade normal';
  }

  readingStatusClass(reading: Reading, criteria: EnvironmentalCriteria): string {
    const adequate = reading.temperatureC >= criteria.temperatureMinC
      && reading.temperatureC <= criteria.temperatureMaxC
      && reading.humidityPercent >= criteria.humidityMinPercent
      && reading.humidityPercent <= criteria.humidityMaxPercent;
    return adequate ? 'is-adequate' : 'is-exception';
  }

  criteriaDescription(description: string): string {
    return description.replace(/,\s*inclusive\.$/i, '.');
  }

  private loadInitialData(): void {
    this.api.getDevices()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (devices) => {
          this.devices.set(devices);
          if (devices.length === 0) {
            this.errorMessage.set('Cadastre um dispositivo antes de gerar relatórios.');
            this.loading.set(false);
            return;
          }
          this.selectedDeviceCode.set(devices[0].deviceCode);
          this.generateReport();
        },
        error: (error) => {
          this.errorMessage.set(this.toErrorMessage(error));
          this.loading.set(false);
        }
      });
  }

  private loadReadings(page: number): void {
    const filters = this.appliedFilters();
    if (!filters) {
      return;
    }
    this.readingsLoading.set(true);
    this.api.getReadings({
      deviceCode: filters.deviceCode,
      page,
      size: this.pageSize,
      startAt: filters.startAt,
      endAt: filters.endAt
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

  private validateRange(): string | null {
    if (!this.selectedDeviceCode()) {
      return 'Selecione um dispositivo.';
    }
    const start = this.startAt();
    const end = this.endAt();
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Informe o início e o fim do período.';
    }
    const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    const elapsedDays = (endDay - startDay) / (24 * 60 * 60 * 1000);
    if (elapsedDays < 0) {
      return 'A data inicial deve ser anterior à data final.';
    }
    if (elapsedDays >= 31) {
      return 'O período máximo do relatório é de 31 dias.';
    }
    return null;
  }

  private toOffsetIso(value: Date, endOfDay: boolean): string {
    const date = new Date(value);
    if (endOfDay) {
      date.setHours(23, 59, 59, 999);
    } else {
      date.setHours(0, 0, 0, 0);
    }
    const offsetMinutes = -date.getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absolute = Math.abs(offsetMinutes);
    const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
    const minutes = String(absolute % 60).padStart(2, '0');
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return `${localDate.toISOString().slice(0, 19)}${sign}${hours}:${minutes}`;
  }

  private drawPdfHeader(document: JsPdfDocument, report: EnvironmentalReport): void {
    document.setFillColor(45, 106, 79);
    document.rect(0, 0, 210, 30, 'F');
    document.setTextColor(255, 255, 255);
    document.setFontSize(18);
    document.setFont('helvetica', 'bold');
    document.text('SmartGarden', 14, 13);
    document.setFontSize(11);
    document.setFont('helvetica', 'normal');
    document.text('Relatório ambiental', 14, 21);
    document.setFontSize(9);
    document.text(report.deviceName, 196, 12, { align: 'right' });
    document.text(`${this.formatDate(report.windowStart)} a ${this.formatDate(report.windowEnd)}`, 196, 19, { align: 'right' });
  }

  private drawPdfSummary(document: JsPdfDocument, report: EnvironmentalReport): number {
    const summary = report.summary;
    const cards = [
      ['Leituras', String(summary.totalReadings)],
      ['Temperatura média', summary.averageTemperatureC == null ? '--' : `${summary.averageTemperatureC.toFixed(1)} °C`],
      ['Umidade média', summary.averageHumidityPercent == null ? '--' : `${summary.averageHumidityPercent.toFixed(1)} %`],
      ['Condições adequadas', summary.adequatePercentage == null ? '--' : `${summary.adequatePercentage.toFixed(1)}%`]
    ];
    cards.forEach(([label, value], index) => {
      const x = 14 + index * 46;
      document.setFillColor(248, 245, 238);
      document.roundedRect(x, 37, 42, 22, 2, 2, 'F');
      document.setTextColor(99, 113, 100);
      document.setFontSize(7);
      document.text(label.toUpperCase(), x + 3, 44);
      document.setTextColor(31, 44, 31);
      document.setFontSize(13);
      document.setFont('helvetica', 'bold');
      document.text(value, x + 3, 54);
      document.setFont('helvetica', 'normal');
    });
    document.setTextColor(31, 44, 31);
    document.setFontSize(10);
    document.setFont('helvetica', 'bold');
    document.text('Diagnóstico do período', 14, 68);
    document.setFont('helvetica', 'normal');
    document.setFontSize(9);
    document.text(document.splitTextToSize(this.diagnosis(), 180), 14, 74);
    return 84;
  }

  private drawPdfCriteria(document: JsPdfDocument, report: EnvironmentalReport, startY: number): number {
    document.setFontSize(10);
    document.setFont('helvetica', 'bold');
    document.setTextColor(31, 44, 31);
    document.text('Como interpretar os dados', 14, startY);
    document.setFont('helvetica', 'normal');
    document.setFontSize(8);
    const criteriaText = [
      this.criteriaDescription(report.criteria.temperatureDescription),
      this.criteriaDescription(report.criteria.humidityDescription),
      report.criteria.environmentDescription
    ].join('  ');
    const lines = document.splitTextToSize(criteriaText, 182);
    document.text(lines, 14, startY + 5);
    const nextY = startY + 8 + lines.length * 3.6;
    document.setFontSize(10);
    document.setFont('helvetica', 'bold');
    document.text(`Exceções recentes (${report.totalExceptions})`, 14, nextY);
    document.setFont('helvetica', 'normal');
    return nextY + 3;
  }

  private drawPdfFooter(document: JsPdfDocument): void {
    const page = document.getNumberOfPages();
    document.setFontSize(7);
    document.setTextColor(99, 113, 100);
    document.text(`SmartGarden · página ${page}`, 196, 290, { align: 'right' });
  }

  private formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  private formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (Array.isArray(error.error?.messages) && error.error.messages.length > 0) {
        return error.error.messages.join(' | ');
      }
      return `Falha ao gerar o relatório (${error.status}).`;
    }
    return 'Falha inesperada ao gerar o relatório.';
  }
}
