import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';

/**
 * Global interceptor that captures ALL GraphQL mutations and REST write operations.
 * Automatically logs every mutation through AuditLogService (console + webhook).
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const contextType = context.getType<string>();

    // Handle GraphQL context
    if (contextType === 'graphql') {
      return this.handleGraphQL(context, next);
    }

    // Handle REST context
    if (contextType === 'http') {
      return this.handleHTTP(context, next);
    }

    return next.handle();
  }

  private handleGraphQL(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();

    // Only intercept mutations (not queries or subscriptions)
    if (info.parentType?.name !== 'Mutation') {
      return next.handle();
    }

    const args = gqlContext.getArgs();
    const user = gqlContext.getContext()?.req?.user;
    const operationName = info.fieldName;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (result) => {
          this.auditLogService.log({
            entity: 'GraphQL',
            action: operationName,
            actor: user ? { uid: user.uid, email: user.email } : undefined,
            after: result,
            metadata: {
              type: 'mutation',
              args: this.sanitizeArgs(args),
              durationMs: Date.now() - startTime,
            },
          });
        },
        error: (error) => {
          this.auditLogService.log({
            entity: 'GraphQL',
            action: operationName,
            actor: user ? { uid: user.uid, email: user.email } : undefined,
            metadata: {
              type: 'mutation_error',
              args: this.sanitizeArgs(args),
              error: error?.message,
              durationMs: Date.now() - startTime,
            },
          });
        },
      }),
    );
  }

  private handleHTTP(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only log write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const user = request.user;
    const path = request.url;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (result) => {
          this.auditLogService.log({
            entity: 'REST',
            action: `${method} ${path}`,
            actor: user ? { uid: user.uid, email: user.email } : undefined,
            after: result,
            metadata: {
              type: 'rest_write',
              body: this.sanitizeArgs(request.body),
              durationMs: Date.now() - startTime,
            },
          });
        },
      }),
    );
  }

  /**
   * Remove sensitive fields from mutation args before logging
   */
  private sanitizeArgs(args: any): any {
    if (!args) return args;
    try {
      const clone = JSON.parse(JSON.stringify(args));
      // Remove potential secrets
      const sensitiveKeys = ['password', 'token', 'secret', 'refreshToken', 'access_token'];
      const sanitize = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
            obj[key] = '[REDACTED]';
          } else {
            sanitize(obj[key]);
          }
        }
      };
      sanitize(clone);
      return clone;
    } catch {
      return '[serialization_error]';
    }
  }
}
