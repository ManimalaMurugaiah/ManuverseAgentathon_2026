# SQL alignment notes

## What was read from db.sql
The SQL defines master and configuration tables for roles, permissions, process templates and stages, escalation levels, risk bands, project and action statuses, notification types, governance rules, and agent definitions.

## Important schema gap
The script does not define complete transaction coverage for project instances, milestone event history, evidence, or audit trails for every workflow event. Governance evaluation therefore depends on trusted facts supplied by the app layer.

## Alignment in this package
- backend/data/sql_seed_reference.json: extracted seed reference data.
- backend/project_delivery_ai/sqlserver_adapter.py: optional pyodbc adapter for SQL master data.
- backend/project_delivery_ai/sql_governance.py: deterministic evaluation against seeded governance conditions.

## Suggested additional transaction coverage
1. ProjectMilestones with forecast and actual dates per project/stage.
2. MilestoneDependencies for critical path impacts.
3. Engineering approvals and drawing revisions.
4. Purchase orders, vendor commitments, and deliveries.
5. Corrective actions and human approvals.
6. Agent run logs and tamper-evident audit records.
