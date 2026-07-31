/*
  Run as sysadmin on the TARGET instance 192.168.1.20\INSERTGT,
  database Magnum_Profi.

  Do not commit real passwords. Replace placeholders only in a secure DBA
  session or use a secret manager.
*/

USE [master];
GO

IF SUSER_ID(N'mcp') IS NULL
BEGIN
  CREATE LOGIN [mcp]
    WITH PASSWORD = N'{{MCP_PASSWORD}}',
    CHECK_POLICY = ON,
    CHECK_EXPIRATION = ON,
    DEFAULT_DATABASE = [Magnum_Profi];
END;
GO

ALTER LOGIN [mcp] ENABLE;
GO

USE [Magnum_Profi];
GO

IF USER_ID(N'mcp') IS NULL
  CREATE USER [mcp] FOR LOGIN [mcp];
GO

ALTER ROLE [db_datareader] ADD MEMBER [mcp];
GO

/* MCP must not write ERP data. */
IF IS_ROLEMEMBER(N'db_datawriter', N'mcp') = 1
  ALTER ROLE [db_datawriter] DROP MEMBER [mcp];
GO
DENY INSERT, UPDATE, DELETE, ALTER, CONTROL ON SCHEMA::[dbo] TO [mcp];
GO

/* Application login: keep reads, remove broad writer role. */
IF IS_ROLEMEMBER(N'db_datawriter', N'pomagier') = 1
  ALTER ROLE [db_datawriter] DROP MEMBER [pomagier];
GO
GRANT UPDATE ON OBJECT::[dbo].[tw__Towar]
  ([tw_Pole1], [tw_Pole2], [tw_Pole3], [tw_Pole4], [tw_Pole5], [tw_Pole6], [tw_Pole7], [tw_Pole8])
  TO [pomagier];
GO

/* Verify after execution. */
SELECT sp.name, sp.type_desc, sp.is_disabled
FROM sys.server_principals sp
WHERE sp.name IN (N'pomagier', N'mcp');

SELECT dp.name AS database_user, rp.name AS database_role
FROM sys.database_role_members drm
JOIN sys.database_principals rp ON rp.principal_id = drm.role_principal_id
JOIN sys.database_principals dp ON dp.principal_id = drm.member_principal_id
WHERE dp.name IN (N'pomagier', N'mcp');
