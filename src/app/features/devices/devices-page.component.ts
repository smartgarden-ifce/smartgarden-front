import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';

import { CreateDeviceRequest, Device } from '../../core/models/smartgarden.models';
import { SmartgardenApiService } from '../../core/services/smartgarden-api.service';

@Component({
  selector: 'app-devices-page',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, SkeletonModule],
  templateUrl: './devices-page.component.html',
  styleUrl: './devices-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevicesPageComponent {
  private readonly api = inject(SmartgardenApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);

  readonly devices = signal<Device[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group({
    deviceCode: ['', [Validators.required, Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    location: ['', [Validators.maxLength(200)]]
  });

  constructor() {
    this.loadDevices();
  }

  submit(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request: CreateDeviceRequest = {
      deviceCode: raw.deviceCode.trim(),
      name: raw.name.trim(),
      location: raw.location.trim() || null
    };
    if (!request.deviceCode || !request.name) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Código e nome não podem conter apenas espaços.');
      return;
    }

    this.saving.set(true);
    this.api.createDevice(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (device) => {
        this.devices.update((devices) => [...devices, device].sort((a, b) => a.name.localeCompare(b.name)));
        this.form.reset();
        this.successMessage.set(`Dispositivo “${device.name}” cadastrado com sucesso.`);
        this.saving.set(false);
      },
      error: (error) => {
        this.errorMessage.set(this.toErrorMessage(error));
        this.saving.set(false);
      }
    });
  }

  fieldInvalid(field: 'deviceCode' | 'name' | 'location'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.dirty || control.touched);
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
      if (error.status === 409) return 'Já existe um dispositivo com este código.';
      return `Falha ao processar dispositivos (${error.status}).`;
    }
    return 'Falha inesperada ao processar dispositivos.';
  }
}
