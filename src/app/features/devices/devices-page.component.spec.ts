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

  it('should load and display the registered devices', () => {
    const fixture = TestBed.createComponent(DevicesPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([{
      id: 1, deviceCode: 'esp32-01', name: 'Sensor 01', location: 'Canteiro', active: true,
      createdAt: '', updatedAt: '', lastSeenAt: null
    }]);
    fixture.detectChanges();

    expect(fixture.componentInstance.devices().length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Sensor 01');
    http.expectNone((request) => request.method === 'POST');
  });

  it('should direct empty inventories to Swagger', () => {
    const fixture = TestBed.createComponent(DevicesPageComponent);
    http.expectOne('http://localhost:8080/api/devices').flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Swagger da API');
  });
});
