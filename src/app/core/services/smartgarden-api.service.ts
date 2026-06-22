import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CreateDeviceRequest,
  DashboardSummary,
  Device,
  EnvironmentalReport,
  PageResponse,
  Reading,
  ReadingHistoryResponse
} from '../models/smartgarden.models';

@Injectable({
  providedIn: 'root'
})
export class SmartgardenApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:8080/api';

  getDashboardSummary(hours: number): Observable<DashboardSummary> {
    const params = new HttpParams().set('hours', hours);
    return this.http.get<DashboardSummary>(`${this.apiBaseUrl}/dashboard/summary`, { params });
  }

  getDevices(): Observable<Device[]> {
    return this.http.get<Device[]>(`${this.apiBaseUrl}/devices`);
  }

  createDevice(request: CreateDeviceRequest): Observable<Device> {
    return this.http.post<Device>(`${this.apiBaseUrl}/devices`, request);
  }

  getReadingHistory(
    deviceCode: string,
    hours: number,
    limit = 120,
    startAt?: string,
    endAt?: string
  ): Observable<ReadingHistoryResponse> {
    let params = new HttpParams()
      .set('deviceCode', deviceCode)
      .set('hours', hours)
      .set('limit', limit);
    if (startAt) params = params.set('startAt', startAt);
    if (endAt) params = params.set('endAt', endAt);
    return this.http.get<ReadingHistoryResponse>(`${this.apiBaseUrl}/readings/history`, { params });
  }

  getReadings(options: {
    deviceCode?: string;
    page: number;
    size: number;
    startAt?: string;
    endAt?: string;
  }): Observable<PageResponse<Reading>> {
    let params = new HttpParams()
      .set('page', options.page)
      .set('size', options.size);

    if (options.deviceCode) {
      params = params.set('deviceCode', options.deviceCode);
    }

    if (options.startAt) {
      params = params.set('startAt', options.startAt);
    }

    if (options.endAt) {
      params = params.set('endAt', options.endAt);
    }

    return this.http.get<PageResponse<Reading>>(`${this.apiBaseUrl}/readings`, { params });
  }

  getEnvironmentalReport(deviceCode: string, startAt: string, endAt: string): Observable<EnvironmentalReport> {
    const params = new HttpParams()
      .set('deviceCode', deviceCode)
      .set('startAt', startAt)
      .set('endAt', endAt);
    return this.http.get<EnvironmentalReport>(`${this.apiBaseUrl}/reports/environmental`, { params });
  }
}
