"""SQL Server adapter for ManuVerseDB master data.

Requires optional dependency: pyodbc. This adapter intentionally reads only tables
present in the supplied db.sql. That script contains master/configuration data but
does not define project instances, milestone dates, action records, or dependency rows.
"""

from __future__ import annotations

import json
import os


class ManuVerseSqlServerAdapter:
    def __init__(self, connection_string: str | None = None):
        self.connection_string = connection_string or os.getenv("MANUVERSE_SQL_CONNECTION")
        if not self.connection_string:
            raise ValueError("Set MANUVERSE_SQL_CONNECTION to a SQL Server ODBC connection string.")

    def _connect(self):
        try:
            import pyodbc
        except ImportError as exc:
            raise RuntimeError("Install optional SQL Server driver package: pip install pyodbc") from exc
        return pyodbc.connect(self.connection_string)

    def load_reference_data(self) -> dict:
        queries = {
            "roles": "SELECT RoleName, Description, IsActive FROM Roles WHERE IsActive=1 ORDER BY RoleId",
            "stages": "SELECT s.StageName, s.SequenceNo FROM ProcessStages s JOIN ProcessTemplates t ON t.TemplateId=s.TemplateId ORDER BY s.SequenceNo",
            "escalation_levels": "SELECT LevelName, Description FROM EscalationLevels ORDER BY EscalationLevelId",
            "risk_levels": "SELECT RiskLevel, RiskScoreFrom, RiskScoreTo FROM RiskLevels ORDER BY RiskScoreFrom",
            "project_statuses": "SELECT StatusName FROM ProjectStatuses ORDER BY StatusId",
            "action_statuses": "SELECT StatusName FROM ActionStatuses ORDER BY StatusId",
            "notification_types": "SELECT NotificationType FROM NotificationTypes ORDER BY NotificationTypeId",
            "governance_rules": "SELECT RuleCode, RuleName, RuleCategory, Severity, ConditionJson, ActionJson FROM GovernanceRules ORDER BY RuleId",
            "agent_definitions": "SELECT AgentName, AgentType, Description, TimeoutSeconds, RetryCount FROM AgentDefinitions ORDER BY AgentId",
        }

        conn = self._connect()
        try:
            result = {}
            for key, query in queries.items():
                cur = conn.cursor()
                cur.execute(query)
                cols = [col[0] for col in cur.description]
                rows = []
                for row in cur.fetchall():
                    item = dict(zip(cols, row))
                    if key == "governance_rules":
                        for field in ("ConditionJson", "ActionJson"):
                            try:
                                item[field] = json.loads(item[field]) if item[field] else {}
                            except (TypeError, json.JSONDecodeError):
                                item[field] = {}
                    rows.append(item)
                result[key] = rows
            return result
        finally:
            conn.close()

    def evaluate_governance_rules(self, facts: dict) -> list[dict]:
        reference = self.load_reference_data()
        findings = []

        for rule in reference["governance_rules"]:
            cond = rule.get("ConditionJson") or {}
            field = next(iter(cond), None)
            if not field:
                findings.append({"rule_code": rule["RuleCode"], "status": "NOT_EVALUATED", "reason": "Empty condition"})
                continue
            if field not in facts:
                findings.append({"rule_code": rule["RuleCode"], "status": "NOT_EVALUATED", "reason": f"Missing fact: {field}"})
                continue

            actual, threshold = facts[field], cond[field]
            if field in {"DelayDays", "DaysRemaining", "OverdueHours", "TimeoutSeconds", "FailureCount"}:
                matched = actual >= threshold if field in {"DelayDays", "OverdueHours", "TimeoutSeconds", "FailureCount"} else actual <= threshold
            else:
                matched = str(actual).lower() == str(threshold).lower()

            findings.append(
                {
                    "rule_code": rule["RuleCode"],
                    "rule_name": rule["RuleName"],
                    "severity": rule["Severity"],
                    "condition": cond,
                    "actual": actual,
                    "status": "TRIGGERED" if matched else "NOT_TRIGGERED",
                    "configured_action": rule.get("ActionJson") or {},
                }
            )

        return findings
