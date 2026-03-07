# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in ConTigo, **please report it responsibly**. Do not open a public GitHub issue.

### How to Report

**Email:** [security@contigo-app.ch](mailto:security@contigo-app.ch)

Include the following in your report:

1. **Description** of the vulnerability
2. **Steps to reproduce** (detailed, step-by-step)
3. **Impact assessment** — what data or functionality is affected
4. **Affected component** — which service, endpoint, or module
5. **Your contact information** for follow-up

### What to Expect

| Step | Timeframe |
|---|---|
| Acknowledgement of your report | Within **48 hours** |
| Initial triage and severity assessment | Within **5 business days** |
| Status update with remediation plan | Within **10 business days** |
| Fix deployed (critical/high) | Within **30 days** |
| Fix deployed (medium/low) | Within **90 days** |
| Credit in security advisory (if desired) | Upon fix release |

### Scope

The following are **in scope** for responsible disclosure:

- ConTigo web application (apps/web)
- API endpoints (/api/*)
- Authentication and authorisation flows
- Data isolation between tenants
- AI pipeline data handling
- File upload and storage processing
- WebSocket connections
- Background worker job processing

The following are **out of scope**:

- Denial of service (DoS/DDoS) attacks
- Social engineering of ConTigo staff
- Physical attacks on infrastructure
- Attacks on third-party services (Azure, Sentry, Stripe)
- Issues in dependencies already reported upstream
- Findings from automated scanners without demonstrated exploit

---

## Supported Versions

| Version | Supported |
|---|---|
| 2.x (current) | Yes |
| 1.x | No — please upgrade |

---

## Security Architecture Overview

ConTigo implements defence-in-depth across multiple layers:

| Layer | Protection |
|---|---|
| **Network** | TLS 1.3, CSP headers, CORS, rate limiting |
| **Authentication** | NextAuth v5, bcryptjs, TOTP MFA, session management |
| **Authorisation** | RBAC with tenant-scoped access, CSRF tokens |
| **Data** | AES-256-GCM encryption at rest, row-level tenant isolation |
| **Application** | Input validation (Zod), parameterised queries (Prisma), XSS protection |
| **Infrastructure** | Docker with non-root user, minimal Alpine images, health checks |
| **Monitoring** | Sentry error tracking, OpenTelemetry tracing, Prometheus metrics, audit logs |

---

## Security Practices

### Code

- No secrets in source code — all via environment variables
- Dependency scanning via `npm audit` and automated alerts
- TypeScript strict mode with explicit types (no `any`)
- All external input validated through Zod schemas

### Infrastructure

- Docker images built from `node:22-alpine` (minimal attack surface)
- Non-root container execution
- Read-only file systems where possible
- Health check endpoints for liveness and readiness probes
- PgBouncer connection pooling to prevent connection exhaustion

### Data

- Swiss data residency (Azure Switzerland North)
- Per-tenant data isolation at the database level
- Encrypted backups with 30-day retention
- Data deletion within 30 days of account cancellation (per DPA)
- No customer data used for AI model training

### Compliance

- Swiss FADP (nDSG) compliant
- EU GDPR compliant
- Preparing for SOC 2 Type II (target: Q4 2026)

---

## Acknowledgements

We gratefully acknowledge security researchers who report vulnerabilities responsibly. With your permission, we will credit you in our security advisories.

---

*ConTigo GmbH — Zurich, Switzerland*
