"""Load SQL-seeded governance policies into a testable evaluation interface."""

import json
from pathlib import Path


class SeedGovernancePolicy:
    def __init__(self, reference_path: str | Path):
        self.reference = json.loads(Path(reference_path).read_text(encoding="utf-8"))
        self.rules = self.reference.get("governance_rules", [])

    def evaluate_facts(self, facts: dict) -> list[dict]:
        findings = []
        for rule in self.rules:
            condition = rule["condition"]
            field = next(iter(condition), None)

            if not field or field not in facts:
                findings.append(
                    {
                        "rule_code": rule["rule_code"],
                        "rule_name": rule["rule_name"],
                        "status": "NOT_EVALUATED",
                        "reason": f"Missing fact: {field}",
                    }
                )
                continue

            actual, expected = facts[field], condition[field]
            if field in {"DelayDays", "OverdueHours", "TimeoutSeconds", "FailureCount"}:
                match = actual >= expected
            elif field == "DaysRemaining":
                match = actual <= expected
            else:
                match = str(actual).lower() == str(expected).lower()

            findings.append(
                {
                    "rule_code": rule["rule_code"],
                    "rule_name": rule["rule_name"],
                    "severity": rule["severity"],
                    "status": "TRIGGERED" if match else "NOT_TRIGGERED",
                    "configured_action": rule["action"],
                    "actual": actual,
                }
            )
        return findings
