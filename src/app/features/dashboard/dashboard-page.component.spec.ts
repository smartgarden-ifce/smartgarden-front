import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
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
});
