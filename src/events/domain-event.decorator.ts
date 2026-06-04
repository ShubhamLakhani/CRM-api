import { SetMetadata } from '@nestjs/common';
import { DomainEventType } from './domain-events';

export const ON_DOMAIN_EVENT_KEY = 'domain_event:listener';

export const OnDomainEvent = (event: DomainEventType) => SetMetadata(ON_DOMAIN_EVENT_KEY, event);
