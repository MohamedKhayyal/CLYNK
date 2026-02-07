CREATE TABLE dbo.Users (
    user_id INT IDENTITY(1,1) PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    photo VARCHAR(500) NULL,

    user_type VARCHAR(20) NOT NULL
        CHECK (user_type IN ('patient', 'doctor', 'staff', 'admin')),

    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE INDEX IX_Users_Email ON dbo.Users(email);
GO

CREATE TABLE dbo.Admins (
    admin_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    full_name NVARCHAR(150) NOT NULL,

    CONSTRAINT FK_Admins_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO

CREATE TABLE dbo.Clinics (
    clinic_id INT IDENTITY(1,1) PRIMARY KEY,
    owner_user_id INT NOT NULL,
    verified_by_admin_id INT NULL,

    name VARCHAR(150) NOT NULL UNIQUE,
    address VARCHAR(255),
    location VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(150) NOT NULL UNIQUE,

    consultation_price DECIMAL(10,2) NULL,
    work_from TIME NULL,
    work_to TIME NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),

    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    verified_at DATETIME2 NULL,

    CONSTRAINT FK_Clinics_Owner
        FOREIGN KEY (owner_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT FK_Clinics_AdminVerifier
        FOREIGN KEY (verified_by_admin_id)
        REFERENCES dbo.Admins(admin_id)
);
GO

CREATE TABLE dbo.Doctors (
    doctor_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,

    full_name NVARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    license_number VARCHAR(50) NOT NULL UNIQUE,
    gender VARCHAR(10),

    specialist NVARCHAR(100) NOT NULL,
    work_days NVARCHAR(100) NOT NULL,
    location NVARCHAR(150) NULL,

    consultation_price DECIMAL(10,2) NULL,
    work_from TIME NULL,
    work_to TIME NULL,

    is_verified BIT NOT NULL DEFAULT 0,
    years_of_experience TINYINT,
    bio NVARCHAR(500),

    CONSTRAINT FK_Doctors_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT CK_Doctors_Specialist
        CHECK (specialist IN (
            N'مخ واعصاب',
            N'عظام',
            N'الأورام',
            N'طب الأذن والأنف والحنجرة',
            N'طب العيون',
            N'قلب و اوعية دموية',
            N'صدر و جهاز تنفسي',
            N'كلى',
            N'اسنان',
            N'اطفال و حديثي الولادة',
            N'جلدية',
            N'نسا و توليد'
        ))
);
GO

CREATE TABLE dbo.Patients (
    patient_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,

    full_name NVARCHAR(150) NOT NULL,
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

    full_name NVARCHAR(150) NOT NULL,
    role_title VARCHAR(20) NOT NULL
        CHECK (role_title IN ('doctor', 'nurse', 'receptionist')),

    specialist NVARCHAR(100) NULL,
    is_verified BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_Staff_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT FK_Staff_Clinics
        FOREIGN KEY (clinic_id)
        REFERENCES dbo.Clinics(clinic_id)
        ON DELETE CASCADE,

    CONSTRAINT CK_Staff_Doctor_Specialist
        CHECK (
            (role_title = 'doctor' AND specialist IN (
                N'مخ واعصاب',
                N'عظام',
                N'الأورام',
                N'طب الأذن والأنف والحنجرة',
                N'طب العيون',
                N'قلب و اوعية دموية',
                N'صدر و جهاز تنفسي',
                N'كلى',
                N'اسنان',
                N'اطفال و حديثي الولادة',
                N'جلدية',
                N'نسا و توليد'
            ))
            OR
            (role_title <> 'doctor' AND specialist IS NULL)
        )
);
GO

CREATE TABLE dbo.Reviews (
    review_id INT IDENTITY(1,1) PRIMARY KEY,

    patient_user_id INT NOT NULL,
    doctor_id INT NULL,
    clinic_id INT NULL,

    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment NVARCHAR(1000) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Reviews_Patient
        FOREIGN KEY (patient_user_id)
        REFERENCES dbo.Users(user_id),

    CONSTRAINT FK_Reviews_Doctor
        FOREIGN KEY (doctor_id)
        REFERENCES dbo.Doctors(doctor_id),

    CONSTRAINT FK_Reviews_Clinic
        FOREIGN KEY (clinic_id)
        REFERENCES dbo.Clinics(clinic_id),

    CONSTRAINT CK_Reviews_Target
        CHECK (
            (doctor_id IS NOT NULL AND clinic_id IS NULL)
            OR
            (doctor_id IS NULL AND clinic_id IS NOT NULL)
        )
);
GO

CREATE TABLE dbo.Notifications (
    notification_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,

    title NVARCHAR(150) NOT NULL,
    message NVARCHAR(500) NOT NULL,

    is_read BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_Notifications_Users
        FOREIGN KEY (user_id)
        REFERENCES dbo.Users(user_id)
        ON DELETE CASCADE
);
GO
