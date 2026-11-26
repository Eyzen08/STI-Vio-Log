const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { normalizeAcademic } = require('../utils/studentAcademic');
const {
    isValidEmail, isValidPhone, normalizePhone, sanitizeString, isValidStudentNumber,
    assertAllowedFields, isValidStudentName, isValidStudentSuffix, normalizeNameSpacing
} = require('../utils/validators');
const { createViolationWithClient, requireIncidentDateNotInFuture } = require('./violationCreationService');

const cleanText = (value, max) => typeof value === 'string'
    ? value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, max)
    : '';

const normalizeFirstViolation = (value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'First violation information must be an object');
    }
    assertAllowedFields(value, ['violation_type_id', 'incident_date', 'incident_time', 'description']);
    if (!value.violation_type_id || !value.incident_date) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Select a violation classification and incident date for the first violation');
    }
    // Reject a future date before any account rows are written so the whole
    // registration fails cleanly instead of relying on a later rollback.
    requireIncidentDateNotInFuture(String(value.incident_date).trim());
    return {
        violation_type_id: value.violation_type_id,
        incident_date: String(value.incident_date).trim(),
        incident_time: value.incident_time || null,
        description: typeof value.description === 'string' ? value.description : null
    };
};

// Validates and normalizes the full official student profile supplied by the
// Discipline Office. Students never submit these values themselves.
const normalizeStudentRegistration = (body = {}) => {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 255 || !isValidEmail(email) || !email.endsWith('@gmail.com')) {
        throw new ApiError(400, 'INVALID_EMAIL', 'Enter a valid personal Gmail address (@gmail.com)');
    }

    const studentNumber = typeof body.student_number === 'string' ? body.student_number.trim() : '';
    if (!isValidStudentNumber(studentNumber)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Student Number must contain exactly 11 digits');
    }

    const firstName = normalizeNameSpacing(cleanText(body.first_name, 150));
    const middleName = normalizeNameSpacing(cleanText(body.middle_name, 150));
    const lastName = normalizeNameSpacing(cleanText(body.last_name, 150));
    const suffix = cleanText(body.suffix, 20);
    if (!isValidStudentName(firstName) || !isValidStudentName(lastName) || !isValidStudentName(middleName, { optional: true })) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Names must contain letters and may include spaces, apostrophes, hyphens, and periods (maximum 150 characters)');
    }
    if (!isValidStudentSuffix(suffix)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Select a valid suffix or None');
    }

    if (!body.academic_level) {
        throw new ApiError(400, 'INVALID_ACADEMIC_LEVEL', 'Select College, Senior High School, or TESDA');
    }
    const academic = normalizeAcademic({
        academic_level: body.academic_level,
        strand: body.strand,
        program: body.program,
        section: body.section,
        year_level: body.year_level
    });

    if (!isValidPhone(body.phone_number)) {
        throw new ApiError(400, 'INVALID_PHONE', 'Enter a valid Philippine student contact number');
    }
    if (!isValidPhone(body.guardian_phone_number)) {
        throw new ApiError(400, 'INVALID_PHONE', 'Enter a valid Philippine guardian contact number');
    }
    const phoneNumber = normalizePhone(body.phone_number);
    const guardianPhoneNumber = normalizePhone(body.guardian_phone_number);
    if (phoneNumber === guardianPhoneNumber) {
        throw new ApiError(400, 'DUPLICATE_PHONE', 'Student and guardian contact numbers must be different');
    }

    const guardianName = cleanText(body.guardian_name, 200);
    if (!isValidStudentName(guardianName, { maxLength: 200 })) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a valid guardian name using letters, spaces, apostrophes, hyphens, and periods');
    }
    const guardianRelationship = cleanText(body.guardian_relationship, 100);
    if (!guardianRelationship) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Enter the guardian relationship');
    }

    return {
        student_number: studentNumber,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        suffix,
        email,
        academic_level: academic.academic_level,
        strand: academic.strand,
        program: academic.program,
        section: academic.section,
        year_level: academic.year_level,
        phone_number: phoneNumber,
        guardian_name: guardianName,
        guardian_relationship: guardianRelationship,
        guardian_phone_number: guardianPhoneNumber,
        first_violation: normalizeFirstViolation(body.first_violation)
    };
};

const createStudentWithClient = async ({ client, registration, actor, ipAddress = null }) => {
    if (!client?.query) throw new TypeError('A database client is required');
    if (!registration) throw new TypeError('A normalized student registration is required');

    await client.query("SELECT pg_advisory_xact_lock(hashtext('student-registration-email:' || LOWER($1)))", [registration.email]);
    if ((await client.query('SELECT 1 FROM students WHERE LOWER(email)=LOWER($1) LIMIT 1', [registration.email])).rows.length) {
        throw new ApiError(409, 'STUDENT_EMAIL_CONFLICT', 'That Gmail address is already assigned to another student');
    }

    const temporaryPassword = crypto.randomBytes(18).toString('base64url') + '!Aa1';
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const account = (await client.query(
        `INSERT INTO users (username,password_hash,role,is_active,must_change_password,email_verified,temporary_password_expires_at)
         VALUES ($1,$2,'STUDENT',TRUE,TRUE,TRUE,CURRENT_TIMESTAMP+INTERVAL '24 hours')
         RETURNING id,username,must_change_password`,
        [registration.student_number, passwordHash]
    )).rows[0];

    const qrCode = `STI-${crypto.randomUUID()}`;
    const student = (await client.query(
        `INSERT INTO students (
            user_id,student_number,first_name,middle_name,last_name,suffix,qr_code,email,
            phone_number,academic_level,strand,program,section,year_level,onboarding_required
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)
         RETURNING *`,
        [
            account.id, registration.student_number, registration.first_name,
            registration.middle_name || null, registration.last_name, registration.suffix || null,
            qrCode, registration.email, registration.phone_number, registration.academic_level,
            registration.strand, registration.program, registration.section, registration.year_level
        ]
    )).rows[0];

    await client.query(
        `INSERT INTO student_guardians (student_id,guardian_name,relationship,phone_number,is_primary)
         VALUES ($1,$2,$3,$4,TRUE)`,
        [student.id, registration.guardian_name, registration.guardian_relationship, registration.guardian_phone_number]
    );

    let violationResult = null;
    if (registration.first_violation) {
        violationResult = await createViolationWithClient({
            client,
            studentId: student.id,
            violationTypeId: registration.first_violation.violation_type_id,
            incidentDate: registration.first_violation.incident_date,
            incidentTime: registration.first_violation.incident_time,
            description: registration.first_violation.description,
            actor,
            ipAddress
        });
    }

    const auditDescription = violationResult
        ? `Created enrolled student record and linked local account; first violation #${violationResult.violation.id}`
        : 'Created enrolled student record and linked local account';
    await client.query(
        `INSERT INTO audit_logs (user_id,action,table_name,record_id,description,ip_address)
         VALUES ($1,'STUDENT_CREATE','students',$2,$3,$4)`,
        [actor.id, student.id, auditDescription, ipAddress]
    );

    return {
        student,
        account,
        temporaryPassword,
        violation: violationResult?.violation || null,
        violationDetails: violationResult
    };
};

module.exports = {
    normalizeFirstViolation,
    normalizeStudentRegistration,
    createStudentWithClient
};
