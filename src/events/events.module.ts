import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { DomainEventEmitter } from './domain-event-emitter';
import { DomainEventExplorer } from './domain-event-explorer.service';

@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [DomainEventEmitter, DomainEventExplorer],
  exports: [DomainEventEmitter],
})
export class EventsModule {}
