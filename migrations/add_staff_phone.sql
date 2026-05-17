IF COL_LENGTH('dbo.Staff', 'phone') IS NULL
BEGIN
    ALTER TABLE dbo.Staff
    ADD phone VARCHAR(20) NULL;
END
GO
