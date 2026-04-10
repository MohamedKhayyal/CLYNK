IF COL_LENGTH('dbo.Bookings', 'prescription_access_status') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings
    ADD prescription_access_status VARCHAR(20) NOT NULL
        CONSTRAINT DF_Bookings_PrescriptionAccessStatus DEFAULT 'not_requested';
END
GO

IF OBJECT_ID('CK_Bookings_PrescriptionAccessStatus', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings
    ADD CONSTRAINT CK_Bookings_PrescriptionAccessStatus
        CHECK (prescription_access_status IN (
            'not_requested',
            'pending',
            'accepted',
            'rejected'
        ));
END
GO

IF COL_LENGTH('dbo.Bookings', 'prescription_access_requested_at') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings
    ADD prescription_access_requested_at DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.Bookings', 'prescription_access_responded_at') IS NULL
BEGIN
    ALTER TABLE dbo.Bookings
    ADD prescription_access_responded_at DATETIME2 NULL;
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Prescriptions (
        prescription_id INT IDENTITY(1,1) PRIMARY KEY,
        booking_id INT NOT NULL,
        patient_id INT NOT NULL,
        doctor_id INT NULL,
        staff_id INT NULL,
        patient_age INT NULL,
        doctor_name NVARCHAR(150) NULL,
        specialty NVARCHAR(100) NULL,
        doctor_emergency_contact VARCHAR(20) NULL,
        visit_date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        symptoms NVARCHAR(500) NULL,
        diagnosis NVARCHAR(500) NULL,
        medication_name NVARCHAR(150) NULL,
        dose NVARCHAR(100) NULL,
        duration NVARCHAR(100) NULL,
        test_name NVARCHAR(150) NULL,
        test_result NVARCHAR(500) NULL,
        test_date DATE NULL,
        notes NVARCHAR(500) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_Prescriptions_Booking
            FOREIGN KEY (booking_id)
            REFERENCES dbo.Bookings(booking_id),

        CONSTRAINT FK_Prescriptions_Patient
            FOREIGN KEY (patient_id)
            REFERENCES dbo.Patients(patient_id),

        CONSTRAINT FK_Prescriptions_Doctor
            FOREIGN KEY (doctor_id)
            REFERENCES dbo.Doctors(doctor_id),

        CONSTRAINT FK_Prescriptions_Staff
            FOREIGN KEY (staff_id)
            REFERENCES dbo.Staff(staff_id),

        CONSTRAINT CK_Prescriptions_Prescriber
            CHECK (
                (doctor_id IS NOT NULL AND staff_id IS NULL)
                OR
                (doctor_id IS NULL AND staff_id IS NOT NULL)
            )
    );
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Prescriptions', 'booking_id') IS NULL
BEGIN
    ALTER TABLE dbo.Prescriptions
    ADD booking_id INT NULL;
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.Prescriptions', 'staff_id') IS NULL
BEGIN
    ALTER TABLE dbo.Prescriptions
    ADD staff_id INT NULL;
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM sys.columns
       WHERE object_id = OBJECT_ID('dbo.Prescriptions')
         AND name = 'doctor_id'
         AND is_nullable = 0
   )
BEGIN
    ALTER TABLE dbo.Prescriptions
    ALTER COLUMN doctor_id INT NULL;
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND OBJECT_ID('FK_Prescriptions_Booking', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Prescriptions
    ADD CONSTRAINT FK_Prescriptions_Booking
        FOREIGN KEY (booking_id)
        REFERENCES dbo.Bookings(booking_id);
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND OBJECT_ID('FK_Prescriptions_Staff', 'F') IS NULL
BEGIN
    ALTER TABLE dbo.Prescriptions
    ADD CONSTRAINT FK_Prescriptions_Staff
        FOREIGN KEY (staff_id)
        REFERENCES dbo.Staff(staff_id);
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND OBJECT_ID('CK_Prescriptions_Prescriber', 'C') IS NULL
BEGIN
    ALTER TABLE dbo.Prescriptions
    ADD CONSTRAINT CK_Prescriptions_Prescriber
        CHECK (
            (doctor_id IS NOT NULL AND staff_id IS NULL)
            OR
            (doctor_id IS NULL AND staff_id IS NOT NULL)
        );
END
GO

IF OBJECT_ID('dbo.Prescriptions', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'UX_Prescriptions_Booking'
         AND object_id = OBJECT_ID('dbo.Prescriptions')
   )
BEGIN
    CREATE UNIQUE INDEX UX_Prescriptions_Booking
    ON dbo.Prescriptions(booking_id)
    WHERE booking_id IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.PrescriptionPermissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PrescriptionPermissions (
        permission_id INT IDENTITY(1,1) PRIMARY KEY,
        patient_user_id INT NOT NULL,
        doctor_id INT NULL,
        staff_id INT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'accepted'
            CHECK (status IN ('accepted', 'revoked')),
        accepted_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_PrescriptionPermissions_Patient
            FOREIGN KEY (patient_user_id)
            REFERENCES dbo.Users(user_id),

        CONSTRAINT FK_PrescriptionPermissions_Doctor
            FOREIGN KEY (doctor_id)
            REFERENCES dbo.Doctors(doctor_id),

        CONSTRAINT FK_PrescriptionPermissions_Staff
            FOREIGN KEY (staff_id)
            REFERENCES dbo.Staff(staff_id),

        CONSTRAINT CK_PrescriptionPermissions_Target
            CHECK (
                (doctor_id IS NOT NULL AND staff_id IS NULL)
                OR
                (doctor_id IS NULL AND staff_id IS NOT NULL)
            )
    );
END
GO

IF OBJECT_ID('dbo.PrescriptionPermissions', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'UX_PrescriptionPermissions_PatientDoctor'
         AND object_id = OBJECT_ID('dbo.PrescriptionPermissions')
   )
BEGIN
    CREATE UNIQUE INDEX UX_PrescriptionPermissions_PatientDoctor
    ON dbo.PrescriptionPermissions(patient_user_id, doctor_id)
    WHERE doctor_id IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.PrescriptionPermissions', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'UX_PrescriptionPermissions_PatientStaff'
         AND object_id = OBJECT_ID('dbo.PrescriptionPermissions')
   )
BEGIN
    CREATE UNIQUE INDEX UX_PrescriptionPermissions_PatientStaff
    ON dbo.PrescriptionPermissions(patient_user_id, staff_id)
    WHERE staff_id IS NOT NULL;
END
GO
