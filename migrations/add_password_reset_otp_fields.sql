IF COL_LENGTH('dbo.Users', 'password_reset_otp') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD password_reset_otp VARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.Users', 'password_reset_otp_expires') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD password_reset_otp_expires DATETIME2 NULL;
END
GO
