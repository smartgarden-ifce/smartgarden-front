import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Reading } from '../models/smartgarden.models';
import { SmartgardenApiService } from './smartgarden-api.service';

describe('SmartgardenApiService', () => {
  let service: SmartgardenApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(SmartgardenApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should load every readings page for a complete export', () => {
    const readings: Reading[] = [];
    service.getAllReadings({
      deviceCode: 'esp32-01',
      startAt: '2026-06-01T00:00:00Z',
      endAt: '2026-06-02T00:00:00Z'
    }).subscribe((result) => readings.push(...result));

    const firstRequest = http.expectOne((request) => request.url.endsWith('/readings')
      && request.params.get('page') === '0'
      && request.params.get('size') === '200');
    firstRequest.flush(pageResponse([reading(2)], 0, false));

    const secondRequest = http.expectOne((request) => request.url.endsWith('/readings')
      && request.params.get('page') === '1'
      && request.params.get('size') === '200');
    secondRequest.flush(pageResponse([reading(1)], 1, true));

    expect(readings.map((item) => item.id)).toEqual([2, 1]);
  });

  function pageResponse(content: Reading[], page: number, last: boolean) {
    return {
      content,
      page,
      size: 200,
      totalElements: 2,
      totalPages: 2,
      first: page === 0,
      last
    };
  }

  function reading(id: number): Reading {
    return {
      id,
      deviceId: 1,
      deviceCode: 'esp32-01',
      deviceName: 'Sensor 01',
      messageId: null,
      temperatureC: 25,
      humidityPercent: 60,
      recordedAt: '2026-06-01T12:00:00Z',
      receivedAt: '2026-06-01T12:00:00Z',
      createdAt: '2026-06-01T12:00:00Z',
      updatedAt: '2026-06-01T12:00:00Z'
    };
  }
});
