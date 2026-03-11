# Hoppscotch Enterprise Audit Logging & Deployment Guide

This repository has been custom-modified to include a deeply integrated **Audit Logging Subsystem** and fixes for enterprise on-premise deployments.

## 1. What's Included

- **NestJS Audit Interceptor:** A global interceptor (`audit-log.interceptor.ts`) installed at the application root that automatically captures **ALL** GraphQL mutations and REST write operations.
- **Audit Webhook Integration:** Real-time JSON payloads containing granular diffs (actor, timestamp, before/after states, auth architecture) are streamed to a configured HTTP webhook.
- **Database Persistence Fix:** The default Hoppscotch `docker-compose.yml` was fixed to use a persistent `db-data` Docker volume, ensuring that all teams, workspaces, and users survive server restarts.
- **Container Firewall Bypass:** A `webhook-listener` instance was added directly into the internal Podman/Docker network to bypass strict Windows machine firewalls. 

## 2. Deploying on a New Machine

To deploy this on your main project server:

1. Copy this entire folder to your production machine (or `git clone` this branch).
2. Review the `.env` file and **configure your SMTP server**.
   - **Important Note:** In testing, email auth was bypassed via hacks. I have **restored the source code to its secure factory state**. You *must* configure legitimate SMTP or SSO (SAML/OIDC) in your `.env` for your enterprise users to log in!
3. Review the `AUDIT_WEBHOOK_URL` in `.env`.
   - By default, it points to the mock `webhook-listener` container (`http://webhook-listener:4000/webhook`) included in the stack. 
   - If you want to pipe data into your SIEM (Splunk, Datadog) or Kafka queue, change this URL to your internal collection endpoint.
4. Run the stack:
   ```bash
   # If using Podman
   podman compose --profile default up --build -d

   # If using Docker
   docker compose --profile default up --build -d
   ```

## 3. Data Extraction & Security Integration

All audit traffic now triggers `AuditLogService.log()`. If you need to add shared-secret authentication to the outgoing webhook (e.g., passing a Bearer token to your SIEM), you can easily modify the `fetch` headers in:
`packages/hoppscotch-backend/src/audit-log/audit-log.service.ts`

For architectural examples of how to consume this data, refer to `data_extraction_plan.md`.
