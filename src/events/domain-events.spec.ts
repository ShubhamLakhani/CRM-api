import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';
import { EventsModule } from './events.module';
import { DomainEventEmitter } from './domain-event-emitter';
import { OnDomainEvent } from './domain-event.decorator';
import { DomainEventType, ContactCreatedPayload } from './domain-events';

@Injectable()
class MockEventListener {
  public receivedEvents: ContactCreatedPayload[] = [];

  @OnDomainEvent(DomainEventType.CONTACT_CREATED)
  handleContactCreated(payload: ContactCreatedPayload) {
    this.receivedEvents.push(payload);
  }
}

describe('Domain Event System', () => {
  let moduleRef: TestingModule;
  let emitter: DomainEventEmitter;
  let listener: MockEventListener;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [EventsModule],
      providers: [MockEventListener],
    }).compile();

    emitter = moduleRef.get<DomainEventEmitter>(DomainEventEmitter);
    listener = moduleRef.get<MockEventListener>(MockEventListener);

    // Trigger the discovery explorer hook
    await moduleRef.init();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('should discover listeners and propagate type-safe events successfully', () => {
    const payload: ContactCreatedPayload = {
      contactId: 'c1-uuid',
      organizationId: 'o1-uuid',
      userId: 'u1-uuid',
      name: 'John Watson',
    };

    emitter.emit(DomainEventType.CONTACT_CREATED, payload);

    expect(listener.receivedEvents).toHaveLength(1);
    expect(listener.receivedEvents[0]).toEqual(payload);
  });

  it('should isolate listener exceptions and continue executing remaining listeners', () => {
    let callCount = 0;
    
    // Register a throwing listener
    emitter.on(DomainEventType.CONTACT_CREATED, () => {
      throw new Error('Listener crash!');
    });

    // Register a succeeding listener
    emitter.on(DomainEventType.CONTACT_CREATED, () => {
      callCount++;
    });

    const payload: ContactCreatedPayload = {
      contactId: 'c2-uuid',
      organizationId: 'o1-uuid',
      userId: 'u1-uuid',
      name: 'Sherlock Holmes',
    };

    // This emit call should NOT throw!
    expect(() => {
      emitter.emit(DomainEventType.CONTACT_CREATED, payload);
    }).not.toThrow();

    // Call count should be incremented (the succeeding listener should still run!)
    expect(callCount).toBe(1);
  });
});
