USE CLYNC;
GO

CREATE TABLE Users (
  id INT IDENTITY(1,1) PRIMARY KEY,

  name NVARCHAR(100) NOT NULL,

  email NVARCHAR(150) NOT NULL UNIQUE,

  password NVARCHAR(255) NOT NULL,

  role NVARCHAR(50)
    CHECK (role IN ('patient','doctor','staff','admin'))
    DEFAULT 'patient',

  created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

  updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

ALTER TABLE Users
ADD CONSTRAINT chk_users_email_format
CHECK (email LIKE '%_@_%._%');
