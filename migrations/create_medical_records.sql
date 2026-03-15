CREATE TABLE dbo.MedicalProfiles (
    profile_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_user_id INT NOT NULL UNIQUE,

    allergies NVARCHAR(500) NULL,
    chronic_conditions NVARCHAR(1000) NULL,
    medical_history NVARCHAR(2000) NULL,
    current_medications NVARCHAR(2000) NULL,
    notes NVARCHAR(2000) NULL,

    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_MedicalProfiles_Patient
        FOREIGN KEY (patient_user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.PatientDoctorPermissions (
    permission_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_user_id INT NOT NULL,
    doctor_user_id INT NOT NULL,

    is_active BIT NOT NULL DEFAULT 1,
    approved_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    revoked_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_PatientDoctorPermissions_Patient
        FOREIGN KEY (patient_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT FK_PatientDoctorPermissions_Doctor
        FOREIGN KEY (doctor_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT UQ_PatientDoctorPermissions
        UNIQUE (patient_user_id, doctor_user_id),

    CONSTRAINT CK_PatientDoctorPermissions_DifferentUsers
        CHECK (patient_user_id <> doctor_user_id)
);
GO

CREATE INDEX IX_PatientDoctorPermissions_PatientDoctor
ON dbo.PatientDoctorPermissions(patient_user_id, doctor_user_id, is_active);
GO

CREATE TABLE dbo.Prescriptions (
    prescription_id INT IDENTITY(1,1) PRIMARY KEY,
    patient_user_id INT NOT NULL,
    doctor_user_id INT NOT NULL,

    diagnosis NVARCHAR(1000) NOT NULL,
    medications NVARCHAR(MAX) NOT NULL,
    instructions NVARCHAR(2000) NULL,
    follow_up_date DATE NULL,

    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Prescriptions_Patient
        FOREIGN KEY (patient_user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Prescriptions_Doctor
        FOREIGN KEY (doctor_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT CK_Prescriptions_DifferentUsers
        CHECK (patient_user_id <> doctor_user_id)
);
GO

CREATE INDEX IX_Prescriptions_PatientCreatedAt
ON dbo.Prescriptions(patient_user_id, created_at DESC);
GO

CREATE INDEX IX_Prescriptions_DoctorCreatedAt
ON dbo.Prescriptions(doctor_user_id, created_at DESC);
GO
