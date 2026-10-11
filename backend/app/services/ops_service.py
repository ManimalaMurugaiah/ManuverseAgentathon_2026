from datetime import date

CLOSED_ACTION_STATUSES = frozenset({"Closed", "Verified"})
RISK_LEVELS = ("Low", "Medium", "High", "Critical")
_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def level_rank(value: str | None) -> int:
    return _RANK.get((value or "").strip().lower(), 1)


def risk_severity(impact: str | None, probability: str | None) -> str:
    """Severity grows with impact x likelihood; likelihood is capped at High (3)."""
    score = level_rank(impact) * min(level_rank(probability), 3)
    if score >= 6:
        return "High"
    return "Medium" if score >= 3 else "Low"


def is_action_overdue(action: object, today: date) -> bool:
    status = getattr(action, "status", None)
    due = getattr(action, "due_date", None)
    return bool(status not in CLOSED_ACTION_STATUSES and due and due < today)
