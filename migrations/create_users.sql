CREATE TABLE dbo.Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) NOT NULL
        CHECK (user_type IN ('patient', 'doctor', 'staff', 'admin')),
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE dbo.Admins (
    admin_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    position_title VARCHAR(100),

    CONSTRAINT FK_Admins_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Clinics (
    clinic_id INT IDENTITY(1,1) PRIMARY KEY,
    admin_id INT NOT NULL,
    name VARCHAR(150) NOT NULL UNIQUE,
    address VARCHAR(255),
    location VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    email VARCHAR(150) NOT NULL UNIQUE,
    opening_hours VARCHAR(100),
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Clinics_Admins
        FOREIGN KEY (admin_id)
        REFERENCES dbo.Admins(admin_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Doctors (
    doctor_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
	phone VARCHAR(20),
    license_number VARCHAR(50) NOT NULL UNIQUE,
    gender VARCHAR(10),
    is_verified BIT NOT NULL DEFAULT 0,
    years_of_experience TINYINT,
    bio VARCHAR(500),

    CONSTRAINT FK_Doctors_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Patients (
    patient_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR(10),
    phone VARCHAR(20),
    blood_type VARCHAR(5),

    CONSTRAINT FK_Patients_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Staff (
    staff_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    clinic_id INT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role_title VARCHAR(100),

    CONSTRAINT FK_Staff_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Staff_Clinics
        FOREIGN KEY (clinic_id)
        REFERENCES dbo.Clinics(clinic_id)
);
GO

CREATE INDEX IX_Users_Email ON dbo.Users(email);

CREATE INDEX IX_Doctors_UserId ON dbo.Doctors(user_id);
CREATE INDEX IX_Patients_UserId ON dbo.Patients(user_id);
CREATE INDEX IX_Staff_UserId ON dbo.Staff(user_id);
CREATE INDEX IX_Staff_ClinicId ON dbo.Staff(clinic_id);
CREATE INDEX IX_Clinics_AdminId ON dbo.Clinics(admin_id);
GO


-- Test
SELECT * FROM dbo.Users;
SELECT * FROM dbo.Admins;
SELECT * FROM dbo.Clinics;
SELECT * FROM dbo.Doctors;
SELECT * FROM dbo.Patients;
SELECT * FROM dbo.Staff;

