USE [ManuverseDB]
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;
GO

/* 1) Guard: Users table must exist */
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    ROLLBACK TRANSACTION;
    THROW 50001, 'Table dbo.Users does not exist.', 1;
END;
GO

/* 2) Backfill Role values */
UPDATE dbo.Users
SET Role = 'viewer'
WHERE Role IS NULL OR LTRIM(RTRIM(Role)) = '';
GO

/* 3) Add default constraint on Role if missing */
IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'Users'
      AND c.name = 'Role'
)
BEGIN
    ALTER TABLE dbo.Users
    ADD CONSTRAINT DF_Users_Role DEFAULT ('viewer') FOR Role;
END;
GO

/* 4) Enforce Role NOT NULL */
IF EXISTS (
    SELECT 1
    FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'Users'
      AND c.name = 'Role'
      AND c.is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.Users
    ALTER COLUMN Role NVARCHAR(32) NOT NULL;
END;
GO

/* 5) Guard before enforcing PasswordHash NOT NULL */
IF EXISTS (
    SELECT 1
    FROM dbo.Users
    WHERE PasswordHash IS NULL OR LTRIM(RTRIM(PasswordHash)) = ''
)
BEGIN
    ROLLBACK TRANSACTION;
    THROW 50002, 'Cannot enforce PasswordHash NOT NULL: found NULL/empty values in dbo.Users.', 1;
END;
GO

/* 6) Enforce PasswordHash NOT NULL */
IF EXISTS (
    SELECT 1
    FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'Users'
      AND c.name = 'PasswordHash'
      AND c.is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.Users
    ALTER COLUMN PasswordHash NVARCHAR(500) NOT NULL;
END;
GO

/* 7) Guard duplicates before unique UserName */
IF EXISTS (
    SELECT UserName
    FROM dbo.Users
    GROUP BY UserName
    HAVING COUNT(*) > 1
)
BEGIN
    ROLLBACK TRANSACTION;
    THROW 50003, 'Cannot add unique index: duplicate UserName values exist in dbo.Users.', 1;
END;
GO

/* 8) Add unique index on UserName if missing */
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Users')
      AND name = N'UX_Users_UserName'
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Users_UserName
    ON dbo.Users (UserName ASC);
END;
GO

COMMIT TRANSACTION;
GO
