import { AsyncLocalStorage } from 'async_hooks';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

export type RequestSource = 'USER' | 'AUTOMATION';

export interface RequestContextStore {
  userId?: string | null;
  organizationId?: string | null;
  ipAddress?: string | null;
  source?: RequestSource;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    let ipAddress = request?.ip;
    if (request?.headers && request.headers['x-forwarded-for']) {
      const forwarded = request.headers['x-forwarded-for'];
      ipAddress = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim();
    }

    const store: RequestContextStore = {
      userId: user?.id || null,
      organizationId: user?.organizationId || null,
      ipAddress: ipAddress || null,
      source: 'USER',
    };

    return requestContextStorage.run(store, () => next.handle());
  }
}
