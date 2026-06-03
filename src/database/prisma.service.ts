import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { requestContextStorage } from '../common/request-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
    const rawClient = this;

    // Create the extended client with audit logging query extension
    const extendedClient = this.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const auditedModels = ['Company', 'Contact', 'Deal', 'Task'];
            if (!model || !auditedModels.includes(model)) {
              return query(args);
            }

            const isWrite = ['create', 'update', 'delete', 'upsert'].includes(operation);
            if (!isWrite) {
              return query(args);
            }

            const store = requestContextStorage.getStore();
            const userId = store?.userId || null;
            const ipAddress = store?.ipAddress || null;
            
            let beforeState: any = null;
            let organizationId = store?.organizationId || null;
            
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);

            // 1. Fetch existing record for UPDATE/DELETE/UPSERT to get "before" state and organizationId
            if ((operation === 'update' || operation === 'delete' || operation === 'upsert') && args?.where) {
              try {
                const existing = await (rawClient as any)[modelKey].findUnique({
                  where: args.where,
                });
                if (existing) {
                  beforeState = existing;
                  if (!organizationId) {
                    organizationId = existing.organizationId;
                  }
                }
              } catch (e) {
                console.error(`[PrismaService] Failed to fetch existing state for audit log`, e);
              }
            }

            // Execute the database operation
            const result = await query(args);

            // 2. Fetch organizationId for CREATE if it wasn't in store/existing
            if (!organizationId) {
              if (result && (result as any).organizationId) {
                organizationId = (result as any).organizationId;
              } else if ((args as any)?.data?.organizationId) {
                organizationId = (args as any).data.organizationId;
              }
            }

            // 3. Construct afterState
            let afterState: any = null;
            if (operation !== 'delete') {
              afterState = result;
            }

            // Determine action type name for log
            let logAction = operation.toUpperCase();
            if (operation === 'upsert') {
              logAction = beforeState ? 'UPDATE' : 'CREATE';
            }

            // If we have an organizationId, create the AuditLog record
            if (organizationId) {
              (rawClient as any).auditLog.create({
                data: {
                  action: logAction,
                  entityType: model.toUpperCase(),
                  entityId: (result as any)?.id || beforeState?.id || null,
                  before: beforeState ? JSON.parse(JSON.stringify(beforeState)) : null,
                  after: afterState ? JSON.parse(JSON.stringify(afterState)) : null,
                  ipAddress,
                  userId,
                  organizationId,
                },
              }).catch((err: any) => {
                console.error(`[PrismaService] Failed to write audit log:`, err);
              });
            }

            return result;
          },
        },
      },
    });

    // Attach NestJS lifecycle hooks to the extended client
    (extendedClient as any).onModuleInit = async () => {
      await (rawClient as any).$connect();
    };
    (extendedClient as any).onModuleDestroy = async () => {
      await (rawClient as any).$disconnect();
    };

    return extendedClient as any;
  }

  // Fallbacks in case NestJS type reflection inspects prototype methods
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
