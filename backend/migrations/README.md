# Migrations Setup

This scaffold uses SQLAlchemy metadata auto-create during startup for local development.

## SQL Server Auth Hardening Migration

Run this script once against `ManuverseDB`:

- `backend/migrations/001_auth_users_hardening.sql`

It performs idempotent auth-table hardening for login:

- Backfills `Users.Role` to `viewer` when missing
- Enforces `Users.Role` as `NOT NULL` with a default
- Enforces `Users.PasswordHash` as `NOT NULL` (with a guard)
- Adds a unique index on `Users.UserName` (with a duplicate guard)

Run in SSMS by opening the script and executing it, or with `sqlcmd`:

- `sqlcmd -S "(localdb)\\MSSQLLocalDB" -d ManuverseDB -E -i "backend/migrations/001_auth_users_hardening.sql"`

For production-style migrations, use Alembic:

1. Install Alembic
   - `pip install alembic`
2. Initialize
   - `alembic init migrations`
3. Configure `sqlalchemy.url` in `alembic.ini` to `DATABASE_URL`
4. Generate migration
   - `alembic revision --autogenerate -m "init schema"`
5. Apply
   - `alembic upgrade head`
