import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DevicesPageComponent } from './devices-page.component';

describe('DevicesPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DevicesPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should create a device and append it to the list', () => {
    const fixture = TestBed.createComponent(DevicesPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    const component = fixture.componentInstance;
    component.form.setValue({ deviceCode: 'esp32-01', name: 'Sensor 01', location: 'Canteiro' });

    component.submit();

    const request = http.expectOne('http://localhost:8080/api/devices');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ deviceCode: 'esp32-01', name: 'Sensor 01', location: 'Canteiro' });
    request.flush({
      id: 1, deviceCode: 'esp32-01', name: 'Sensor 01', location: 'Canteiro', active: true,
      createdAt: '', updatedAt: '', lastSeenAt: null
    });

    expect(component.devices().length).toBe(1);
    expect(component.successMessage()).toContain('cadastrado com sucesso');
  });

  it('should present a conflict when the device code already exists', () => {
    const fixture = TestBed.createComponent(DevicesPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    const component = fixture.componentInstance;
    component.form.setValue({ deviceCode: 'esp32-01', name: 'Sensor duplicado', location: '' });

    component.submit();
    http.expectOne('http://localhost:8080/api/devices').flush({}, { status: 409, statusText: 'Conflict' });

    expect(component.errorMessage()).toContain('Já existe');
  });
});
