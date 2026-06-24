import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { ReadingEventsService, ReadingStreamSignal } from '../../core/services/reading-events.service';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  let http: HttpTestingController;
  let eventSignals: Subject<ReadingStreamSignal>;

  beforeEach(async () => {
    eventSignals = new Subject<ReadingStreamSignal>();
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReadingEventsService, useValue: { watch: () => eventSignals } }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should load only summary and devices', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    http.expectOne((request) => request.url.endsWith('/dashboard/summary') && request.params.get('hours') === '24').flush({
      generatedAt: '', windowStart: '', windowHours: 24, totalDevices: 0, activeDevices: 0,
      totalReadings: 0, readingsInWindow: 0, averageTemperatureCInWindow: null,
      averageHumidityPercentInWindow: null, latestReadingsByDevice: [],
      criteria: {
        temperatureMinC: 20, temperatureMaxC: 30, humidityMinPercent: 40, humidityMaxPercent: 70,
        temperatureDescription: '', humidityDescription: '', environmentDescription: ''
      }
    });
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    http.expectNone((request) => request.url.endsWith('/readings'));

    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('should refresh dashboard data when the SSE stream emits', fakeAsync(() => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    http.expectOne((request) => request.url.endsWith('/dashboard/summary')).flush(summaryResponse());
    http.expectOne('http://localhost:8080/api/devices').flush([]);

    eventSignals.next({ type: 'connected' });
    tick(500);

    http.expectOne((request) => request.url.endsWith('/dashboard/summary')).flush(summaryResponse());
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    expect(fixture.componentInstance.loading()).toBeFalse();
  }));

  function summaryResponse() {
    return {
      generatedAt: '', windowStart: '', windowHours: 24, totalDevices: 0, activeDevices: 0,
      totalReadings: 0, readingsInWindow: 0, averageTemperatureCInWindow: null,
      averageHumidityPercentInWindow: null, latestReadingsByDevice: [],
      criteria: {
        temperatureMinC: 20, temperatureMaxC: 30, humidityMinPercent: 40, humidityMaxPercent: 70,
        temperatureDescription: '', humidityDescription: '', environmentDescription: ''
      }
    };
  }
});
