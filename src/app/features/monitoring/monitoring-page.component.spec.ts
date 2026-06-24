import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { ReadingEventsService, ReadingStreamSignal } from '../../core/services/reading-events.service';
import { MonitoringPageComponent } from './monitoring-page.component';

describe('MonitoringPageComponent', () => {
  let http: HttpTestingController;
  let eventSignals: Subject<ReadingStreamSignal>;
  let readingEvents: jasmine.SpyObj<ReadingEventsService>;

  beforeEach(async () => {
    eventSignals = new Subject<ReadingStreamSignal>();
    readingEvents = jasmine.createSpyObj<ReadingEventsService>('ReadingEventsService', ['watch']);
    readingEvents.watch.and.returnValue(eventSignals);
    await TestBed.configureTestingModule({
      imports: [MonitoringPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ReadingEventsService, useValue: readingEvents }
      ]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should select the first device and load history, readings and criteria', () => {
    const fixture = TestBed.createComponent(MonitoringPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([{
      id: 1, deviceCode: 'esp32-01', name: 'Sensor 01', location: null, active: true,
      createdAt: '', updatedAt: '', lastSeenAt: null
    }]);

    const historyRequest = http.expectOne((request) => request.url.endsWith('/readings/history'));
    expect(historyRequest.request.params.get('deviceCode')).toBe('esp32-01');
    expect(historyRequest.request.params.get('hours')).toBe('24');
    historyRequest.flush({ deviceCode: 'esp32-01', deviceName: 'Sensor 01', windowStart: '', windowEnd: '', totalPoints: 0, readings: [] });

    const readingsRequest = http.expectOne((request) => request.url.endsWith('/readings'));
    expect(readingsRequest.request.params.get('deviceCode')).toBe('esp32-01');
    expect(readingsRequest.request.params.has('startAt')).toBeTrue();
    expect(readingsRequest.request.params.has('endAt')).toBeTrue();
    readingsRequest.flush({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true });

    http.expectOne((request) => request.url.endsWith('/dashboard/summary')).flush({
      criteria: {
        temperatureMinC: 20, temperatureMaxC: 30, humidityMinPercent: 40, humidityMaxPercent: 70,
        temperatureDescription: '', humidityDescription: '', environmentDescription: ''
      }
    });

    expect(fixture.componentInstance.selectedDeviceCode()).toBe('esp32-01');
    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(readingEvents.watch).toHaveBeenCalledWith('esp32-01');
  });

  it('should show an empty state when there are no devices', () => {
    const fixture = TestBed.createComponent(MonitoringPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Nenhum dispositivo cadastrado');
  });

  it('should refresh monitoring data when the SSE stream emits', fakeAsync(() => {
    const fixture = TestBed.createComponent(MonitoringPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([deviceResponse()]);
    flushMonitoringRequests();

    eventSignals.next({ type: 'connected' });
    tick(500);
    flushMonitoringRequests();

    expect(fixture.componentInstance.loading()).toBeFalse();
  }));

  function deviceResponse() {
    return {
      id: 1, deviceCode: 'esp32-01', name: 'Sensor 01', location: null, active: true,
      createdAt: '', updatedAt: '', lastSeenAt: null
    };
  }

  function flushMonitoringRequests(): void {
    http.expectOne((request) => request.url.endsWith('/readings/history')).flush({
      deviceCode: 'esp32-01', deviceName: 'Sensor 01', windowStart: '', windowEnd: '', totalPoints: 0, readings: []
    });
    http.expectOne((request) => request.url.endsWith('/readings')).flush({
      content: [], page: 0, size: 20, totalElements: 0, totalPages: 0, first: true, last: true
    });
    http.expectOne((request) => request.url.endsWith('/dashboard/summary')).flush({
      criteria: {
        temperatureMinC: 20, temperatureMaxC: 30, humidityMinPercent: 40, humidityMaxPercent: 70,
        temperatureDescription: '', humidityDescription: '', environmentDescription: ''
      }
    });
  }
});
