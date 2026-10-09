from sqlalchemy import create_engine, inspect, text

from app.core.config import settings


def main() -> None:
    engine = create_engine(settings.database_url, pool_pre_ping=True)
    inspector = inspect(engine)
    columns = {col["name"].lower() for col in inspector.get_columns("users")}

    with engine.begin() as conn:
        if "role" not in columns:
            conn.execute(text("ALTER TABLE users ADD Role NVARCHAR(32) NULL"))

        conn.execute(
            text(
                "UPDATE users "
                "SET Role='admin' "
                "WHERE UserName='admin' AND (Role IS NULL OR LTRIM(RTRIM(Role))='')"
            )
        )
        conn.execute(
            text(
                "UPDATE users "
                "SET Role='viewer' "
                "WHERE Role IS NULL OR LTRIM(RTRIM(Role))=''"
            )
        )

    print("users_role_ready")


if __name__ == "__main__":
    main()
