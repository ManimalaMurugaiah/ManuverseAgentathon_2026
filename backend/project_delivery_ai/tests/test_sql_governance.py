import unittest
from pathlib import Path

from project_delivery_ai.sql_governance import SeedGovernancePolicy

ROOT = Path(__file__).resolve().parents[2]


class SqlGovernanceTests(unittest.TestCase):
    def setUp(self):
        self.policy = SeedGovernancePolicy(ROOT / "data" / "sql_seed_reference.json")

    def test_drawing_approval_rule_triggers_over_five_days(self):
        findings = self.policy.evaluate_facts({"DelayDays": 6})
        hit = next(x for x in findings if x["rule_code"] == "GOV-ENG-002")
        self.assertEqual(hit["status"], "TRIGGERED")
        self.assertEqual(hit["configured_action"], {"Escalate": "ProjectManager"})

    def test_missing_fact_is_not_guessed(self):
        findings = self.policy.evaluate_facts({})
        self.assertTrue(all(x["status"] == "NOT_EVALUATED" for x in findings))

    def test_safety_clearance_rule(self):
        findings = self.policy.evaluate_facts({"SafetyClearance": "Missing"})
        hit = next(x for x in findings if x["rule_code"] == "GOV-EHS-001")
        self.assertEqual(hit["status"], "TRIGGERED")


if __name__ == "__main__":
    unittest.main()
