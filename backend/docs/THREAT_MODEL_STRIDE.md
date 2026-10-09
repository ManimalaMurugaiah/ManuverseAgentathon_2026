# Threat Model (STRIDE) - Manuverse POC

## Scope

- Frontend React client
- FastAPI backend (`/api/v1`)
- SQL Server data store
- JWT auth and role-gated APIs

## STRIDE Summary

## Spoofing

- Risk: attacker reuses stolen JWT.
- Mitigations: short-lived access token, refresh rotation, logout revocation, lockout and rate limits.

## Tampering

- Risk: unauthorized mutation of workflow resources.
- Mitigations: RBAC route guards + object-level checks on workflow runs.

## Repudiation

- Risk: user denies API actions.
- Mitigations: request audit logs and correlation IDs.

## Information Disclosure

- Risk: stack traces or sensitive details exposed.
- Mitigations: generic error responses, masked auth metadata in logs.

## Denial of Service

- Risk: high-volume requests and oversized payloads.
- Mitigations: rate limiting and request-size middleware.

## Elevation of Privilege

- Risk: low-privilege role accessing privileged endpoints.
- Mitigations: `require_roles` checks and per-resource controls.

## Residual Risks

- In-memory token and run-ownership stores are non-durable.
- No MFA/SSO in POC.
- No distributed rate limiting across multiple instances.

## Recommended Next Production Steps

1. Move token and ownership state to Redis or SQL.
2. Integrate enterprise IdP (OIDC) with MFA.
3. Add SIEM sink and immutable audit logs.
4. Add API gateway/WAF and DDoS protection.
