from sqlalchemy.orm import Session

from app.core.security import validate_password_policy
from app.core.security import get_password_hash
from app.models.user import User


def seed_defaults(db: Session) -> None:
    existing_admin = db.query(User).filter(User.username == "admin").first()
    if existing_admin:
        if existing_admin.role != "admin":
            existing_admin.role = "admin"
            db.commit()
        return

    valid, message = validate_password_policy("Admin@123")
    if not valid:
        raise ValueError(message or "Seed admin password does not meet policy")

    admin = User(username="admin", password_hash=get_password_hash("Admin@123"), role="admin")
    db.add(admin)
    db.commit()
