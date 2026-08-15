-- ============================================================
-- STI VIO-LOG
-- Initial Database Schema
-- PostgreSQL
-- ============================================================

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM (
    'STUDENT',
    'DEPARTMENT_HEAD',
    'DISCIPLINE_OFFICE',
    'ADMIN'
);

CREATE TYPE violation_severity AS ENUM (
    'MINOR',
    'MAJOR',
    'GRAVE'
);

CREATE TYPE violation_status AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'COMPLETED',
    'CLEARED'
);

CREATE TYPE attendance_type AS ENUM (
    'TIME_IN',
    'TIME_OUT'
);

CREATE TYPE clearance_status AS ENUM (
    'NOT_ELIGIBLE',
    'PENDING',
    'CLEARED'
);

-- ============================================================
-- USERS
-- Login accounts for students, department heads,
-- Discipline Office personnel, and administrators.
-- ============================================================

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,

    username VARCHAR(100) UNIQUE NOT NULL,

    password_hash TEXT NOT NULL,

    role user_role NOT NULL,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
    id BIGSERIAL PRIMARY KEY,

    department_code VARCHAR(50) UNIQUE NOT NULL,

    department_name VARCHAR(150) NOT NULL,

    description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- STUDENTS
-- ============================================================

CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT UNIQUE NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    student_number VARCHAR(50) UNIQUE NOT NULL,

    first_name VARCHAR(100) NOT NULL,

    middle_name VARCHAR(100),

    last_name VARCHAR(100) NOT NULL,

    suffix VARCHAR(20),

    email VARCHAR(255),

    phone_number VARCHAR(30),

    program VARCHAR(150),

    section VARCHAR(100),

    year_level INT,

    qr_code TEXT UNIQUE NOT NULL,

    profile_image TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PARENT / GUARDIAN CONTACT
-- ============================================================

CREATE TABLE student_guardians (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT NOT NULL
        REFERENCES students(id) ON DELETE CASCADE,

    guardian_name VARCHAR(200) NOT NULL,

    relationship VARCHAR(100),

    phone_number VARCHAR(30) NOT NULL,

    email VARCHAR(255),

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- DEPARTMENT HEADS
-- ============================================================

CREATE TABLE department_heads (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT UNIQUE NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    department_id BIGINT NOT NULL
        REFERENCES departments(id),

    employee_number VARCHAR(50) UNIQUE,

    first_name VARCHAR(100) NOT NULL,

    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(255),

    qr_scanner_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VIOLATION TYPES
-- ============================================================

CREATE TABLE violation_types (
    id BIGSERIAL PRIMARY KEY,

    violation_code VARCHAR(50) UNIQUE NOT NULL,

    violation_name VARCHAR(200) NOT NULL,

    description TEXT,

    severity violation_severity NOT NULL,

    default_service_hours NUMERIC(6,2) NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VIOLATIONS
-- ============================================================

CREATE TABLE violations (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT NOT NULL
        REFERENCES students(id),

    violation_type_id BIGINT NOT NULL
        REFERENCES violation_types(id),

    reported_by BIGINT
        REFERENCES users(id),

    incident_date DATE NOT NULL,

    description TEXT,

    status violation_status NOT NULL DEFAULT 'OPEN',

    required_service_hours NUMERIC(6,2) NOT NULL DEFAULT 0,

    completed_service_hours NUMERIC(6,2) NOT NULL DEFAULT 0,

    cleared_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- COMMUNITY SERVICE ASSIGNMENTS
-- ============================================================

CREATE TABLE community_service_assignments (
    id BIGSERIAL PRIMARY KEY,

    violation_id BIGINT UNIQUE NOT NULL
        REFERENCES violations(id) ON DELETE CASCADE,

    student_id BIGINT NOT NULL
        REFERENCES students(id),

    required_hours NUMERIC(6,2) NOT NULL,

    completed_hours NUMERIC(6,2) NOT NULL DEFAULT 0,

    remaining_hours NUMERIC(6,2) NOT NULL,

    status violation_status NOT NULL DEFAULT 'OPEN',

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    completed_at TIMESTAMPTZ
);

-- ============================================================
-- COMMUNITY SERVICE DTR / ATTENDANCE
--
-- Department Head scans student's QR code.
-- The system records TIME IN and TIME OUT.
-- ============================================================

CREATE TABLE community_service_attendance (
    id BIGSERIAL PRIMARY KEY,

    assignment_id BIGINT NOT NULL
        REFERENCES community_service_assignments(id)
        ON DELETE CASCADE,

    student_id BIGINT NOT NULL
        REFERENCES students(id),

    department_id BIGINT NOT NULL
        REFERENCES departments(id),

    scanned_by BIGINT NOT NULL
        REFERENCES users(id),

    attendance_type attendance_type NOT NULL,

    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    notes TEXT
);

-- ============================================================
-- DEPARTMENT SCANNER LOG
-- Keeps track of QR scanning activity.
-- ============================================================

CREATE TABLE qr_scan_logs (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT NOT NULL
        REFERENCES students(id),

    scanned_by BIGINT NOT NULL
        REFERENCES users(id),

    department_id BIGINT
        REFERENCES departments(id),

    scan_type attendance_type NOT NULL,

    scanned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    device_information TEXT,

    ip_address INET
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    notification_type VARCHAR(100),

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MESSAGES
-- Communication between students and school personnel.
-- ============================================================

CREATE TABLE messages (
    id BIGSERIAL PRIMARY KEY,

    sender_id BIGINT NOT NULL
        REFERENCES users(id),

    receiver_id BIGINT NOT NULL
        REFERENCES users(id),

    message TEXT NOT NULL,

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- CLEARANCE
--
-- Used to determine whether a student can proceed with
-- enrollment after violations have been resolved.
-- ============================================================

CREATE TABLE student_clearance (
    id BIGSERIAL PRIMARY KEY,

    student_id BIGINT UNIQUE NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    academic_year VARCHAR(20) NOT NULL,

    semester VARCHAR(50) NOT NULL,

    status clearance_status NOT NULL DEFAULT 'NOT_ELIGIBLE',

    has_active_violation BOOLEAN NOT NULL DEFAULT FALSE,

    has_pending_service BOOLEAN NOT NULL DEFAULT FALSE,

    cleared_by BIGINT
        REFERENCES users(id),

    cleared_at TIMESTAMPTZ,

    remarks TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- AUDIT LOGS
--
-- Records important actions performed by school personnel.
-- ============================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id),

    action VARCHAR(100) NOT NULL,

    table_name VARCHAR(100),

    record_id BIGINT,

    description TEXT,

    ip_address INET,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_students_student_number
    ON students(student_number);

CREATE INDEX idx_students_qr_code
    ON students(qr_code);

CREATE INDEX idx_violations_student
    ON violations(student_id);

CREATE INDEX idx_violations_status
    ON violations(status);

CREATE INDEX idx_service_student
    ON community_service_assignments(student_id);

CREATE INDEX idx_attendance_student
    ON community_service_attendance(student_id);

CREATE INDEX idx_attendance_scanned_at
    ON community_service_attendance(scanned_at);

CREATE INDEX idx_notifications_user
    ON notifications(user_id);

CREATE INDEX idx_audit_logs_user
    ON audit_logs(user_id);

-- ============================================================
-- INITIAL VIOLATION TYPES
-- ============================================================

INSERT INTO violation_types
(
    violation_code,
    violation_name,
    description,
    severity,
    default_service_hours
)
VALUES
(
    'MINOR',
    'Minor Violation',
    'Minor student violation',
    'MINOR',
    2
),
(
    'MAJOR',
    'Major Violation',
    'Major student violation',
    'MAJOR',
    5
),
(
    'GRAVE',
    'Grave Violation',
    'Grave student violation',
    'GRAVE',
    10
);