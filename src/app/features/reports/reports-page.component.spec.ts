import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { EnvironmentalCriteria } from '../../core/models/smartgarden.models';
import { ReportsPageComponent } from './reports-page.component';

describe('ReportsPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should show an empty-device message', () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);

    expect(fixture.componentInstance.errorMessage()).toContain('Cadastre um dispositivo');
    expect(fixture.componentInstance.loading()).toBeFalse();
  });

  it('should classify boundary values as adequate', () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    const component = fixture.componentInstance;
    const criteria: EnvironmentalCriteria = {
      temperatureMinC: 20,
      temperatureMaxC: 30,
      humidityMinPercent: 40,
      humidityMaxPercent: 70,
      temperatureDescription: '',
      humidityDescription: '',
      environmentDescription: ''
    };

    expect(component.temperatureStatus(20, criteria)).toBe('Temperatura agradável');
    expect(component.temperatureStatus(30, criteria)).toBe('Temperatura agradável');
    expect(component.humidityStatus(40, criteria)).toBe('Umidade normal');
    expect(component.humidityStatus(70, criteria)).toBe('Umidade normal');
    expect(component.readingStatusClass({ temperatureC: 20, humidityPercent: 70 } as never, criteria))
      .toBe('is-adequate');
  });

  it('should hide inclusive suffix from criteria descriptions', () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);

    expect(fixture.componentInstance.criteriaDescription('Temperatura agradável entre 20 e 30 °C, inclusive.'))
      .toBe('Temperatura agradável entre 20 e 30 °C.');
  });

  it('should reject a period greater than 31 days before calling the API', () => {
    const fixture = TestBed.createComponent(ReportsPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    const component = fixture.componentInstance;
    component.selectedDeviceCode.set('esp32-01');
    component.startAt.set(new Date(2026, 0, 1));
    component.endAt.set(new Date(2026, 1, 2));

    component.generateReport();

    expect(component.errorMessage()).toContain('31 dias');
    http.expectNone((request) => request.url.includes('/reports/environmental'));
  });
});
