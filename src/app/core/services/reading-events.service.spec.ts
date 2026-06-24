import { TestBed } from '@angular/core/testing';

import { EVENT_SOURCE_FACTORY, ReadingEventsService, ReadingStreamSignal } from './reading-events.service';

class FakeEventSource {
  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  closed = false;

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback = listener as (event: Event) => void;
    const callbacks = this.listeners.get(type) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(type, callbacks);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.get(type)?.delete(listener as (event: Event) => void);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, data?: unknown): void {
    const event = data === undefined
      ? new Event(type)
      : new MessageEvent(type, { data: JSON.stringify(data) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }
}

describe('ReadingEventsService', () => {
  let fakeSource: FakeEventSource;
  let capturedUrl: string;
  let service: ReadingEventsService;

  beforeEach(() => {
    fakeSource = new FakeEventSource();
    capturedUrl = '';
    TestBed.configureTestingModule({
      providers: [{
        provide: EVENT_SOURCE_FACTORY,
        useValue: (url: string) => {
          capturedUrl = url;
          return fakeSource as unknown as EventSource;
        }
      }]
    });
    service = TestBed.inject(ReadingEventsService);
  });

  it('should filter by device, emit reconnect signals and close the stream', () => {
    const signals: ReadingStreamSignal[] = [];
    const subscription = service.watch('esp32 jardim').subscribe((signal) => signals.push(signal));

    fakeSource.emit('connected');
    fakeSource.emit('connected');
    fakeSource.emit('reading-created', {
      id: 1,
      deviceCode: 'esp32 jardim',
      temperatureC: 25,
      humidityPercent: 60
    });
    subscription.unsubscribe();

    expect(capturedUrl).toContain('deviceCode=esp32%20jardim');
    expect(signals.map((signal) => signal.type)).toEqual(['connected', 'connected', 'reading-created']);
    expect(fakeSource.closed).toBeTrue();
  });
});
