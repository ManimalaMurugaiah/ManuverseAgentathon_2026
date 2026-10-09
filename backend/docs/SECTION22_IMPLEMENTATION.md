# Section 22 Security Implementation Matrix

## Implemented in this repository (POC)

- JWT access tokens with short expiry (`access_token_expire_minutes=15`).
- Refresh token rotation (`/api/v1/auth/refresh`) and revocation (`/api/v1/auth/logout-refresh`).
- Access token revocation (`/api/v1/auth/logout`) with server-side token blacklist checks.
- Account lockout and brute-force protection on login.
- RBAC authorization using role checks in API dependencies.
- Object-level authorization for workflow runs (owner tracking + admin/manager/viewer override).
- Password hashing with bcrypt.
- Password policy validator (length, upper/lower/digit/special).
- Input/schema validation via Pydantic models.
- SQL injection-resistant ORM usage for app queries.
- Secure error handling: generic user-facing validation/500 responses.
- Security headers middleware (`X-Frame-Options`, CSP, `X-Content-Type-Options`, etc.).
- Request size limits middleware.
- API rate limiting middleware.
- Request correlation IDs (`X-Request-ID`).
- Audit-style request logging with masked auth data.
- CORS restrictions for frontend origins.
- No hard-coded frontend credentials.
- Secret hygiene via `.gitignore` + `.env.example` pattern.

## Implemented as project process/docs hooks

- Dependency scanning: run `pip-audit` (backend) and `npm audit` (frontend) in CI.
- Secret scanning: enforce gitleaks or equivalent in CI.
- Threat modeling: see `backend/docs/THREAT_MODEL_STRIDE.md`.
- Least privilege principle: codified with role-based route restrictions.

## Production-only controls (require infrastructure)

- Enterprise SSO and MFA.
- WAF and DDoS controls.
- mTLS / zero-trust service-to-service mesh.
- Secret manager with key rotation.
- Encryption at rest and centralized SIEM.
- Compliance mapping (SOC2/ISO/GDPR/DPDP) and periodic pen tests.

## Notes

- Object-level authorization currently uses in-memory ownership mapping for workflow runs in this POC.
- For durable authorization across restarts/instances, persist run ownership in SQL schema.
