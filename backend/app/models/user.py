from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "Users"

    id: Mapped[int] = mapped_column("UserId", primary_key=True, index=True)
    username: Mapped[str] = mapped_column("UserName", String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column("PasswordHash", String(500))
    role: Mapped[str] = mapped_column("Role", String(32), default="viewer", server_default="viewer")
    email: Mapped[str | None] = mapped_column("Email", String(200))
    is_active: Mapped[bool | None] = mapped_column("IsActive", Boolean, default=True, server_default=text("1"))
    created_at: Mapped[datetime | None] = mapped_column("CreatedDate", DateTime)
