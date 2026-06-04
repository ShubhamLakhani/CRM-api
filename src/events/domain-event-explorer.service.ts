import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { DomainEventEmitter } from './domain-event-emitter';
import { ON_DOMAIN_EVENT_KEY } from './domain-event.decorator';

@Injectable()
export class DomainEventExplorer implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly eventEmitter: DomainEventEmitter,
  ) {}

  onModuleInit() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    const instances = [...providers, ...controllers];

    for (const wrapper of instances) {
      const { instance } = wrapper;
      if (!instance || typeof instance !== 'object') {
        continue;
      }

      const prototype = Object.getPrototypeOf(instance);
      if (!prototype) {
        continue;
      }

      // Scanner retrieves all methods defined on prototype
      const methodNames = this.metadataScanner.getAllMethodNames(prototype);

      for (const methodName of methodNames) {
        const methodRef = instance[methodName];
        if (typeof methodRef !== 'function') {
          continue;
        }

        const eventType = this.reflector.get(ON_DOMAIN_EVENT_KEY, methodRef);
        if (eventType) {
          // Bind the listener method execution context to the provider instance
          this.eventEmitter.on(eventType, methodRef.bind(instance));
        }
      }
    }
  }
}
