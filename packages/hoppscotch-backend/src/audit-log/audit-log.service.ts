import { Injectable } from '@nestjs/common';

/**
 * AuditLogService - Service-level audit logging for Hoppscotch
 * 
 * Logs all CRUD operations on Teams, Collections, Requests, and Environments.
 * Dispatches audit payloads to:
 *   1. Console (always — visible in container logs)
 *   2. Webhook URL (if AUDIT_WEBHOOK_URL is configured)
 */
@Injectable()
export class AuditLogService {
  private readonly webhookUrl: string | undefined;

  constructor() {
    this.webhookUrl = process.env.AUDIT_WEBHOOK_URL;
    console.log(`[AuditLogService] Initialized. Webhook URL: ${this.webhookUrl || 'NOT SET (console-only mode)'}`);
  }

  /**
   * Log an audit event. Always logs to console; optionally dispatches to webhook.
   */
  async log(event: {
    entity: string;       // e.g. 'TeamCollection', 'TeamRequest', 'Team'
    action: string;       // e.g. 'CREATE', 'UPDATE', 'DELETE'
    actor?: {             // Who performed the action
      uid?: string;
      email?: string;
    };
    teamId?: string;
    before?: any;         // State before mutation (for UPDATE/DELETE)
    after?: any;          // State after mutation (for CREATE/UPDATE)
    metadata?: any;       // Additional context (e.g. parent collection, diff details)
  }): Promise<void> {
    const payload = {
      ...event,
      timestamp: new Date().toISOString(),
      source: 'hoppscotch-audit',
    };

    // 1. Always log to console (visible via `podman logs`)
    console.log(
      `\n[AUDIT LOG] ${payload.action} ${payload.entity}` +
      (payload.actor?.email ? ` by ${payload.actor.email}` : '') +
      (payload.teamId ? ` in team ${payload.teamId}` : '')
    );
    console.log(JSON.stringify(payload, null, 2));

    // 2. Dispatch to webhook if configured
    if (this.webhookUrl) {
      try {
        const res = await fetch(this.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Hoppscotch-Audit/1.0',
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          console.warn(`[AuditLogService] Webhook returned ${res.status}`);
        }
      } catch (err) {
        console.error(`[AuditLogService] Webhook dispatch failed:`, err instanceof Error ? err.message : err);
      }
    }
  }
}
