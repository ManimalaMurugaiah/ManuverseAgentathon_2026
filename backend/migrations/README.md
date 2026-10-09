# Migrations Setup

This scaffold uses SQLAlchemy metadata auto-create during startup for local development.

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
