import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { Device } from '../../core/models/smartgarden.models';
import { SmartgardenApiService } from '../../core/services/smartgarden-api.service';

@Component({
  selector: 'app-devices-page',
  standalone: true,
  imports: [DatePipe, MessageModule, SkeletonModule],
  templateUrl: './devices-page.component.html',
  styleUrl: './devices-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevicesPageComponent {
  private readonly api = inject(SmartgardenApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly devices = signal<Device[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.loadDevices();
  }

  private loadDevices(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.api.getDevices().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.loading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(this.toErrorMessage(error));
        this.loading.set(false);
      }
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error?.message === 'string') return error.error.message;
      if (Array.isArray(error.error?.messages) && error.error.messages.length) return error.error.messages.join(' | ');
      return `Falha ao consultar dispositivos (${error.status}).`;
    }
    return 'Falha inesperada ao consultar dispositivos.';
  }
}
