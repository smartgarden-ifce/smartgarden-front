import { Injectable, InjectionToken, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Reading } from '../models/smartgarden.models';

export type ReadingStreamSignal =
  | { type: 'connected' }
  | { type: 'reading-created'; reading: Reading };

export const EVENT_SOURCE_FACTORY = new InjectionToken<(url: string) => EventSource>(
  'EVENT_SOURCE_FACTORY',
  { providedIn: 'root', factory: () => (url) => new EventSource(url) }
);

@Injectable({ providedIn: 'root' })
export class ReadingEventsService {
  private readonly zone = inject(NgZone);
  private readonly eventSourceFactory = inject(EVENT_SOURCE_FACTORY);
  private readonly eventsUrl = 'http://localhost:8080/api/events/readings';

  watch(deviceCode?: string): Observable<ReadingStreamSignal> {
    return new Observable((subscriber) => {
      const url = deviceCode
        ? `${this.eventsUrl}?deviceCode=${encodeURIComponent(deviceCode)}`
        : this.eventsUrl;
      const source = this.eventSourceFactory(url);

      const onConnected = () => this.zone.run(() => subscriber.next({ type: 'connected' }));
      const onReading = (event: Event) => {
        try {
          const reading = JSON.parse((event as MessageEvent<string>).data) as Reading;
          this.zone.run(() => subscriber.next({ type: 'reading-created', reading }));
        } catch {
          // Uma mensagem malformada nao deve encerrar a reconexao automatica do EventSource.
        }
      };

      source.addEventListener('connected', onConnected);
      source.addEventListener('reading-created', onReading);

      return () => {
        source.removeEventListener('connected', onConnected);
        source.removeEventListener('reading-created', onReading);
        source.close();
      };
    });
  }
}
