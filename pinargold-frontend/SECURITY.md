# Security foundation (not production-ready)

- Session endpoint returns anonymous until an authentication provider and RBAC are implemented. Auth Context is UI state only, never authorization.
- Backend config uses HttpOnly + SameSite Strict cookies and Secure by default. Configure a strong SECRET_KEY through secret management before enabling sessions. CSRF protection is required for authenticated state-changing requests.
- AuditEvent model and record_audit are provided for future authenticated mutations. A trusted backend actor must be supplied; no public audit-writing route exists. Create database migrations and retention policies before production.
- WebSocket manager supports WSS URL, reconnect backoff and cleanup, but does not yet consume real quotes. Prices remain simulated.
- VITE_ variables are public. Do not store tokens, API keys or passwords in them.
- Deploy behind TLS termination, restrict proxy headers to trusted infrastructure, and validate origin, role permissions, session lifetime and regulatory requirements before production.
