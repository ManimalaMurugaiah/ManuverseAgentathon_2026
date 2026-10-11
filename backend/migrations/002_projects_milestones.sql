USE [ManuverseDB]
GO

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.Projects', N'U') IS NULL OR OBJECT_ID(N'dbo.Milestones', N'U') IS NULL
    THROW 50010, 'dbo.Projects and dbo.Milestones must exist before running this migration.', 1;
GO

IF COL_LENGTH('dbo.Projects', 'AiAgentsEnabled') IS NULL
    ALTER TABLE dbo.Projects
    ADD AiAgentsEnabled BIT NOT NULL CONSTRAINT DF_Projects_AiAgentsEnabled DEFAULT (1);
GO

IF COL_LENGTH('dbo.Milestones', 'ProgressPct') IS NULL
    ALTER TABLE dbo.Milestones
    ADD ProgressPct INT NOT NULL CONSTRAINT DF_Milestones_ProgressPct DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Milestones_ProgressPct')
    ALTER TABLE dbo.Milestones
    ADD CONSTRAINT CK_Milestones_ProgressPct CHECK (ProgressPct BETWEEN 0 AND 100);
GO

/* Align legacy status vocabulary with the API: Not Started / In Progress / Completed / Delayed / At Risk */
UPDATE dbo.Milestones SET Status = 'Not Started' WHERE Status = 'Pending';
UPDATE dbo.Milestones SET ProgressPct = 100 WHERE Status = 'Completed' AND ProgressPct <> 100;
GO

IF OBJECT_ID(N'dbo.MilestoneApprovalSteps', N'U') IS NULL
CREATE TABLE dbo.MilestoneApprovalSteps
(
    StepId INT IDENTITY(1,1) PRIMARY KEY,
    MilestoneId INT NOT NULL REFERENCES dbo.Milestones (MilestoneId),
    StepNo INT NOT NULL,
    StepName VARCHAR(100) NOT NULL,
    Actor VARCHAR(100) NULL,
    Status VARCHAR(20) NOT NULL,
    CONSTRAINT UQ_MilestoneApprovalSteps UNIQUE (MilestoneId, StepNo)
);
GO

IF OBJECT_ID(N'dbo.MilestoneEvidence', N'U') IS NULL
CREATE TABLE dbo.MilestoneEvidence
(
    EvidenceId INT IDENTITY(1,1) PRIMARY KEY,
    MilestoneId INT NOT NULL REFERENCES dbo.Milestones (MilestoneId),
    FileName VARCHAR(200) NOT NULL,
    UploadedBy VARCHAR(100) NOT NULL,
    UploadedAt DATETIME NOT NULL
);
GO
