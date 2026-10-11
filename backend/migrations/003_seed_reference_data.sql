USE [ManuverseDB]
GO

SET NOCOUNT ON;
GO

/* Idempotent reference/master data. Each row is keyed on its natural key, so re-running changes nothing. */

INSERT INTO dbo.Roles (RoleName, Description)
SELECT v.RoleName, v.Description
FROM (VALUES
    ('SuperAdmin', 'Platform Administration'),
    ('ProcessAdmin', 'Process Configuration'),
    ('ProjectManager', 'Project Governance'),
    ('EngineeringLead', 'Engineering Activities'),
    ('ProcurementLead', 'Procurement Activities'),
    ('PlantEngineering', 'Site Readiness'),
    ('GovernanceManager', 'Governance Management'),
    ('AgentAdministrator', 'Agent Management'),
    ('Executive', 'Portfolio Visibility'),
    ('Auditor', 'Audit Access'),
    ('Viewer', 'Read Only')
) v (RoleName, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Roles r WHERE r.RoleName = v.RoleName);
GO

INSERT INTO dbo.Permissions (PermissionName, Description)
SELECT v.PermissionName, v.Description
FROM (VALUES
    ('MANAGE_USERS', 'Manage users'),
    ('MANAGE_ROLES', 'Manage roles'),
    ('MANAGE_PROJECTS', 'Manage projects'),
    ('MANAGE_PROCESS', 'Manage process templates'),
    ('MANAGE_ACTIVITIES', 'Manage activities'),
    ('MANAGE_DEPENDENCIES', 'Manage dependencies'),
    ('MANAGE_RISKS', 'Manage risks'),
    ('MANAGE_ACTIONS', 'Manage actions'),
    ('MANAGE_GOVERNANCE', 'Manage governance'),
    ('MANAGE_AGENTS', 'Manage agents'),
    ('VIEW_REPORTS', 'View reports'),
    ('VIEW_AUDIT_LOGS', 'View audit logs'),
    ('VIEW_DASHBOARD', 'View dashboard'),
    ('EXECUTE_AGENTS', 'Execute agents'),
    ('MANAGE_NOTIFICATIONS', 'Manage notifications'),
    ('VIEW_MONITORING', 'View monitoring')
) v (PermissionName, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions p WHERE p.PermissionName = v.PermissionName);
GO

/* SuperAdmin receives every permission; other roles receive the listed subset. */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.RoleId, p.PermissionId
FROM dbo.Roles r
CROSS JOIN dbo.Permissions p
WHERE r.RoleName = 'SuperAdmin'
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = r.RoleId AND rp.PermissionId = p.PermissionId);
GO

INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.RoleId, p.PermissionId
FROM (VALUES
    ('ProjectManager', 'MANAGE_PROJECTS'),
    ('ProjectManager', 'MANAGE_RISKS'),
    ('ProjectManager', 'MANAGE_ACTIONS'),
    ('ProjectManager', 'VIEW_REPORTS'),
    ('ProjectManager', 'VIEW_DASHBOARD'),
    ('EngineeringLead', 'MANAGE_ACTIVITIES'),
    ('EngineeringLead', 'MANAGE_RISKS'),
    ('EngineeringLead', 'MANAGE_ACTIONS'),
    ('EngineeringLead', 'VIEW_DASHBOARD'),
    ('ProcurementLead', 'MANAGE_ACTIVITIES'),
    ('ProcurementLead', 'MANAGE_RISKS'),
    ('ProcurementLead', 'MANAGE_ACTIONS'),
    ('ProcurementLead', 'VIEW_DASHBOARD'),
    ('Executive', 'VIEW_REPORTS'),
    ('Executive', 'VIEW_DASHBOARD')
) m (RoleName, PermissionName)
JOIN dbo.Roles r ON r.RoleName = m.RoleName
JOIN dbo.Permissions p ON p.PermissionName = m.PermissionName
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId = r.RoleId AND rp.PermissionId = p.PermissionId);
GO

INSERT INTO dbo.ProcessTemplates (TemplateName, Description)
SELECT 'Manufacturing Project Delivery', 'Manufacturing EPC Project Governance'
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProcessTemplates WHERE TemplateName = 'Manufacturing Project Delivery');
GO

INSERT INTO dbo.ProcessStages (TemplateId, StageName, SequenceNo)
SELECT t.TemplateId, v.StageName, v.SequenceNo
FROM (VALUES
    ('Design Freeze', 1), ('Drawing Approval', 2), ('PO Release', 3), ('Vendor Manufacturing', 4),
    ('FAT', 5), ('Shipment', 6), ('Site Readiness', 7), ('Equipment Delivery', 8),
    ('Installation', 9), ('Mechanical Completion', 10), ('SAT', 11), ('Commissioning', 12),
    ('Production Handover', 13)
) v (StageName, SequenceNo)
CROSS JOIN dbo.ProcessTemplates t
WHERE t.TemplateName = 'Manufacturing Project Delivery'
  AND NOT EXISTS (SELECT 1 FROM dbo.ProcessStages s WHERE s.TemplateId = t.TemplateId AND s.StageName = v.StageName);
GO

INSERT INTO dbo.EscalationLevels (LevelName, Description)
SELECT v.LevelName, v.Description
FROM (VALUES
    ('L0', 'Activity Owner'), ('L1', 'Functional Lead'), ('L2', 'Project Manager'),
    ('L3', 'Plant Manager'), ('L4', 'Steering Committee')
) v (LevelName, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.EscalationLevels e WHERE e.LevelName = v.LevelName);
GO

INSERT INTO dbo.RiskLevels (RiskLevel, RiskScoreFrom, RiskScoreTo)
SELECT v.RiskLevel, v.RiskScoreFrom, v.RiskScoreTo
FROM (VALUES ('Low', 0, 25), ('Medium', 26, 50), ('High', 51, 75), ('Critical', 76, 100)) v (RiskLevel, RiskScoreFrom, RiskScoreTo)
WHERE NOT EXISTS (SELECT 1 FROM dbo.RiskLevels r WHERE r.RiskLevel = v.RiskLevel);
GO

INSERT INTO dbo.ProjectStatuses (StatusName)
SELECT v.StatusName
FROM (VALUES ('Draft'), ('Planning'), ('Execution'), ('On Hold'), ('Completed'), ('Cancelled')) v (StatusName)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProjectStatuses s WHERE s.StatusName = v.StatusName);
GO

INSERT INTO dbo.ActionStatuses (StatusName)
SELECT v.StatusName
FROM (VALUES ('Open'), ('Assigned'), ('In Progress'), ('Overdue'), ('Closed'), ('Verified')) v (StatusName)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ActionStatuses s WHERE s.StatusName = v.StatusName);
GO

INSERT INTO dbo.NotificationTypes (NotificationType)
SELECT v.NotificationType
FROM (VALUES ('Reminder'), ('Escalation'), ('Risk Alert'), ('Agent Failure'), ('Governance Alert'), ('System Alert')) v (NotificationType)
WHERE NOT EXISTS (SELECT 1 FROM dbo.NotificationTypes n WHERE n.NotificationType = v.NotificationType);
GO

INSERT INTO dbo.GovernanceRules (RuleCode, RuleName, RuleCategory, Severity, ConditionJson, ActionJson)
SELECT v.RuleCode, v.RuleName, v.RuleCategory, v.Severity, v.ConditionJson, v.ActionJson
FROM (VALUES
    ('GOV-ENG-001', 'Design Freeze Delayed > 2 Days', 'Engineering', 'Amber', '{"DelayDays":2}', '{"Notify":"EngineeringLead"}'),
    ('GOV-ENG-002', 'Drawing Approval Delayed > 5 Days', 'Engineering', 'Red', '{"DelayDays":5}', '{"Escalate":"ProjectManager"}'),
    ('GOV-PROC-001', 'PO Release Delayed > 3 Days', 'Procurement', 'Amber', '{"DelayDays":3}', '{"Notify":"ProcurementLead"}'),
    ('GOV-PROC-002', 'Vendor Manufacturing Delayed', 'Procurement', 'Red', '{"DelayDays":5}', '{"Escalate":"ProjectManager"}'),
    ('GOV-LOG-001', 'Shipment Delayed', 'Logistics', 'High', '{"DelayDays":3}', '{"Notify":"ProjectManager"}'),
    ('GOV-SITE-001', 'Site Readiness Incomplete', 'Site', 'High', '{"Readiness":"Incomplete"}', '{"Block":"Installation"}'),
    ('GOV-INST-001', 'Installation Delayed', 'Execution', 'Red', '{"DelayDays":3}', '{"Escalate":"PlantManager"}'),
    ('GOV-MECH-001', 'Mechanical Completion Delayed', 'Execution', 'High', '{"DelayDays":2}', '{"Notify":"ProjectManager"}'),
    ('GOV-SAT-001', 'SAT Delayed', 'Testing', 'Critical', '{"DelayDays":2}', '{"Escalate":"PlantManager"}'),
    ('GOV-COM-001', 'Commissioning Delayed', 'Commissioning', 'Critical', '{"DelayDays":1}', '{"Escalate":"SteeringCommittee"}'),
    ('GOV-HO-001', 'Production Handover Delayed', 'Operations', 'Critical', '{"DelayDays":1}', '{"Escalate":"SteeringCommittee"}'),
    ('GOV-EHS-001', 'Safety Clearance Missing', 'Safety', 'Critical', '{"SafetyClearance":"Missing"}', '{"Action":"BlockActivity"}'),
    ('GOV-ACT-001', 'Action Due Tomorrow', 'Action', 'Medium', '{"DaysRemaining":1}', '{"Action":"Reminder"}'),
    ('GOV-ACT-002', 'Action Overdue > 48 Hours', 'Action', 'High', '{"OverdueHours":48}', '{"Escalate":"ProjectManager"}'),
    ('GOV-AGT-001', 'Agent Timeout', 'Agent', 'High', '{"TimeoutSeconds":30}', '{"Action":"StopAgent"}'),
    ('GOV-AGT-002', 'Agent Failure > 3', 'Agent', 'Critical', '{"FailureCount":3}', '{"Action":"DisableAgent"}')
) v (RuleCode, RuleName, RuleCategory, Severity, ConditionJson, ActionJson)
WHERE NOT EXISTS (SELECT 1 FROM dbo.GovernanceRules g WHERE g.RuleCode = v.RuleCode);
GO

INSERT INTO dbo.AgentDefinitions (AgentName, AgentType, Description, TimeoutSeconds, RetryCount)
SELECT v.AgentName, v.AgentType, v.Description, 30, 3
FROM (VALUES
    ('Engineering Design Agent', 'Engineering', 'Design governance'),
    ('Design Approval Agent', 'Engineering', 'Approval tracking'),
    ('Procurement Agent', 'Procurement', 'PO monitoring'),
    ('Vendor Manufacturing Agent', 'Vendor', 'Vendor tracking'),
    ('Shipment Agent', 'Logistics', 'Shipment monitoring'),
    ('Site Readiness Agent', 'Site', 'Site readiness checks'),
    ('Installation Agent', 'Execution', 'Installation monitoring'),
    ('SAT Agent', 'Testing', 'SAT monitoring'),
    ('Commissioning Agent', 'Commissioning', 'Commissioning tracking'),
    ('Handover Agent', 'Operations', 'Production handover'),
    ('Governance Agent', 'Governance', 'Governance engine'),
    ('Notification Agent', 'Notification', 'Alerts and reminders'),
    ('Monitoring Agent', 'Monitoring', 'Agent health monitoring')
) v (AgentName, AgentType, Description)
WHERE NOT EXISTS (SELECT 1 FROM dbo.AgentDefinitions a WHERE a.AgentName = v.AgentName);
GO

/* Link the app's admin account to the SuperAdmin role; a no-op until that user exists. */
INSERT INTO dbo.UserRoles (UserId, RoleId)
SELECT u.UserId, r.RoleId
FROM dbo.Users u
JOIN dbo.Roles r ON r.RoleName = 'SuperAdmin'
WHERE u.UserName = 'admin'
  AND NOT EXISTS (SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = u.UserId AND ur.RoleId = r.RoleId);
GO
