USE [ManuverseDB]
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.Projects', N'U') IS NULL OR OBJECT_ID(N'dbo.Risks', N'U') IS NULL
   OR OBJECT_ID(N'dbo.Actions', N'U') IS NULL OR OBJECT_ID(N'dbo.GovernanceRules', N'U') IS NULL
    THROW 50040, 'Run ManuVerseDB.sql and migrations 001-003 first.', 1;
GO

/* ---- Projects: fields captured by the create/edit project wizard ---- */
IF COL_LENGTH('dbo.Projects', 'ProjectType') IS NULL ALTER TABLE dbo.Projects ADD ProjectType VARCHAR(100) NULL;
IF COL_LENGTH('dbo.Projects', 'Description') IS NULL ALTER TABLE dbo.Projects ADD Description VARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Projects', 'BusinessObjective') IS NULL ALTER TABLE dbo.Projects ADD BusinessObjective VARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Projects', 'Scope') IS NULL ALTER TABLE dbo.Projects ADD Scope VARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Projects', 'BusinessName') IS NULL ALTER TABLE dbo.Projects ADD BusinessName VARCHAR(150) NULL;
IF COL_LENGTH('dbo.Projects', 'Sponsor') IS NULL ALTER TABLE dbo.Projects ADD Sponsor VARCHAR(100) NULL;
IF COL_LENGTH('dbo.Projects', 'Resources') IS NULL ALTER TABLE dbo.Projects ADD Resources VARCHAR(500) NULL;
IF COL_LENGTH('dbo.Projects', 'BudgetSpent') IS NULL
    ALTER TABLE dbo.Projects ADD BudgetSpent DECIMAL(18,2) NOT NULL CONSTRAINT DF_Projects_BudgetSpent DEFAULT (0);
IF COL_LENGTH('dbo.Projects', 'HealthRating') IS NULL
    ALTER TABLE dbo.Projects ADD HealthRating VARCHAR(20) NOT NULL CONSTRAINT DF_Projects_HealthRating DEFAULT ('Good');
GO

/* ---- Risks ---- */
IF COL_LENGTH('dbo.Risks', 'Title') IS NULL ALTER TABLE dbo.Risks ADD Title VARCHAR(200) NULL;
IF COL_LENGTH('dbo.Risks', 'RiskType') IS NULL
    ALTER TABLE dbo.Risks ADD RiskType VARCHAR(20) NOT NULL CONSTRAINT DF_Risks_RiskType DEFAULT ('Risk');
IF COL_LENGTH('dbo.Risks', 'Status') IS NULL
    ALTER TABLE dbo.Risks ADD Status VARCHAR(20) NOT NULL CONSTRAINT DF_Risks_Status DEFAULT ('Open');
IF COL_LENGTH('dbo.Risks', 'DueDate') IS NULL ALTER TABLE dbo.Risks ADD DueDate DATE NULL;
IF COL_LENGTH('dbo.Risks', 'Mitigation') IS NULL ALTER TABLE dbo.Risks ADD Mitigation VARCHAR(1000) NULL;
IF COL_LENGTH('dbo.Risks', 'MilestoneId') IS NULL ALTER TABLE dbo.Risks ADD MilestoneId INT NULL;
IF COL_LENGTH('dbo.Risks', 'CreatedAt') IS NULL
    ALTER TABLE dbo.Risks ADD CreatedAt DATETIME NOT NULL CONSTRAINT DF_Risks_CreatedAt DEFAULT (GETUTCDATE());
GO
UPDATE dbo.Risks SET Title = LEFT(RiskDescription, 200) WHERE Title IS NULL;
GO

/* ---- Actions ---- */
IF COL_LENGTH('dbo.Actions', 'Title') IS NULL ALTER TABLE dbo.Actions ADD Title VARCHAR(200) NULL;
IF COL_LENGTH('dbo.Actions', 'Priority') IS NULL
    ALTER TABLE dbo.Actions ADD Priority VARCHAR(20) NOT NULL CONSTRAINT DF_Actions_Priority DEFAULT ('Medium');
IF COL_LENGTH('dbo.Actions', 'ActionType') IS NULL
    ALTER TABLE dbo.Actions ADD ActionType VARCHAR(20) NOT NULL CONSTRAINT DF_Actions_ActionType DEFAULT ('Task');
IF COL_LENGTH('dbo.Actions', 'RunBy') IS NULL
    ALTER TABLE dbo.Actions ADD RunBy VARCHAR(20) NOT NULL CONSTRAINT DF_Actions_RunBy DEFAULT ('Manual');
IF COL_LENGTH('dbo.Actions', 'ApprovalStatus') IS NULL
    ALTER TABLE dbo.Actions ADD ApprovalStatus VARCHAR(20) NOT NULL CONSTRAINT DF_Actions_ApprovalStatus DEFAULT ('None');
IF COL_LENGTH('dbo.Actions', 'MilestoneId') IS NULL ALTER TABLE dbo.Actions ADD MilestoneId INT NULL;
IF COL_LENGTH('dbo.Actions', 'CreatedAt') IS NULL
    ALTER TABLE dbo.Actions ADD CreatedAt DATETIME NOT NULL CONSTRAINT DF_Actions_CreatedAt DEFAULT (GETUTCDATE());
IF COL_LENGTH('dbo.Actions', 'CompletedAt') IS NULL ALTER TABLE dbo.Actions ADD CompletedAt DATETIME NULL;
GO
UPDATE dbo.Actions SET Title = LEFT(Description, 200) WHERE Title IS NULL;
GO

/* ---- Governance rules can be switched off from Settings ---- */
IF COL_LENGTH('dbo.GovernanceRules', 'IsActive') IS NULL
    ALTER TABLE dbo.GovernanceRules ADD IsActive BIT NOT NULL CONSTRAINT DF_GovernanceRules_IsActive DEFAULT (1);
GO

/* ---- New tables ---- */
IF OBJECT_ID(N'dbo.ProjectTypes', N'U') IS NULL
CREATE TABLE dbo.ProjectTypes
(
    ProjectTypeId INT IDENTITY(1,1) PRIMARY KEY,
    TypeName VARCHAR(100) NOT NULL CONSTRAINT UQ_ProjectTypes_TypeName UNIQUE,
    IsActive BIT NOT NULL CONSTRAINT DF_ProjectTypes_IsActive DEFAULT (1)
);
GO

IF OBJECT_ID(N'dbo.AppSettings', N'U') IS NULL
CREATE TABLE dbo.AppSettings
(
    SettingKey VARCHAR(100) NOT NULL PRIMARY KEY,
    SettingValue VARCHAR(1000) NOT NULL,
    UpdatedBy VARCHAR(100) NULL,
    UpdatedAt DATETIME NOT NULL CONSTRAINT DF_AppSettings_UpdatedAt DEFAULT (GETUTCDATE())
);
GO

IF OBJECT_ID(N'dbo.SavedReports', N'U') IS NULL
CREATE TABLE dbo.SavedReports
(
    ReportId INT IDENTITY(1,1) PRIMARY KEY,
    Title VARCHAR(200) NOT NULL,
    ReportType VARCHAR(50) NOT NULL,
    ProjectId INT NULL,
    Period VARCHAR(20) NULL,
    CreatedBy VARCHAR(100) NOT NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_SavedReports_CreatedAt DEFAULT (GETUTCDATE())
);
GO

IF OBJECT_ID(N'dbo.ReportSchedules', N'U') IS NULL
CREATE TABLE dbo.ReportSchedules
(
    ScheduleId INT IDENTITY(1,1) PRIMARY KEY,
    Name VARCHAR(200) NOT NULL,
    ReportType VARCHAR(50) NOT NULL,
    Frequency VARCHAR(20) NOT NULL,
    Format VARCHAR(10) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_ReportSchedules_IsActive DEFAULT (1),
    CreatedBy VARCHAR(100) NOT NULL,
    CreatedAt DATETIME NOT NULL CONSTRAINT DF_ReportSchedules_CreatedAt DEFAULT (GETUTCDATE())
);
GO

/* ---- Reference values (idempotent) ---- */
INSERT INTO dbo.ProjectTypes (TypeName)
SELECT v.TypeName
FROM (VALUES ('Expansion'), ('New Installation'), ('Modernization'), ('Maintenance & Upgrade'),
             ('Digital Transformation'), ('Compliance & Safety')) v (TypeName)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProjectTypes t WHERE t.TypeName = v.TypeName);
GO
