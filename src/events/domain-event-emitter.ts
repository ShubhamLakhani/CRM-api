import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { DomainEventType, DomainEventPayloads } from './domain-events';

@Injectable()
export class DomainEventEmitter {
  private readonly emitter = new EventEmitter();
  private readonly logger = new Logger(DomainEventEmitter.name);

  emit<K extends DomainEventType>(event: K, payload: DomainEventPayloads[K]): void {
    this.logger.log(`[Event Emission] Emitting event: "${event}" with payload: ${JSON.stringify(payload)}`);
    const listeners = this.emitter.listeners(event);
    for (const listener of listeners) {
      try {
        const result = listener(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            this.logger.error(`[Event Error] Async listener for event "${event}" failed: ${err.message}`, err.stack);
          });
        }
      } catch (err) {
        this.logger.error(
          `[Event Error] Listener for event "${event}" failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }

  on<K extends DomainEventType>(
    event: K,
    listener: (payload: DomainEventPayloads[K]) => void,
  ): () => void {
    this.emitter.on(event, listener);
    return () => {
      this.emitter.off(event, listener);
    };
  }
}
