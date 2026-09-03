const crypto = require('crypto');
const pool = require('../config/database');
const { assertAllowedFields, isPositiveId } = require('../utils/validators');
const { ApiError } = require('../utils/api');
const { createEmailService } = require('../services/emailService');
const { certificateCode, clearanceIdFromCode, hoursInWords, renderCertificatePdf, parseSignatureImage } = require('../services/clearanceCertificateService');
const { getStudentClearanceEligibility } = require('./clearanceController');

const clean = (value, max) => String(value || '').trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, max);
const studentName = (row) => [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(' ');
const publicCertificate = (row) => ({
  id: Number(row.id), certificate_code: certificateCode(row.id), certificate_number: row.certificate_number,
  student_id: Number(row.student_id), student_number: row.student_number, student_name: row.student_name,
  program: row.program, completed_hours: Number(row.completed_hours), hours_in_words: hoursInWords(row.completed_hours),
  issue_date: row.issue_date, status: row.status, version: row.version, student_email: row.student_email,
  email_status: row.email_status, emailed_at: row.emailed_at, created_at: row.created_at,
  revoked_at: row.revoked_at, revocation_reason: row.revocation_reason
});
const handle = (res, error, fallback) => res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : fallback });
const audit = (client, actor, action, table, record, description, ip) => client.query(
  'INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address) VALUES($1,$2,$3,$4,$5,$6)',
  [actor, action, table, record, description, ip || null]
);

const getEligibleStudents = async (req, res) => {
  try {
    assertAllowedFields(req.query, []);
    const result = await pool.query(`SELECT s.id,s.student_number,s.first_name,s.middle_name,s.last_name,s.suffix,s.program,s.email,
      sc.id AS clearance_id,sc.status AS clearance_status,sc.cleared_at,
      COALESCE(SUM(a.required_hours),0)::numeric AS required_hours,COALESCE(SUM(a.completed_hours),0)::numeric AS completed_hours,
      COUNT(a.id)::int AS assignment_count,
      EXISTS(SELECT 1 FROM clearance_certificates cc WHERE cc.student_id=s.id AND cc.status='ISSUED') AS has_issued_certificate
      FROM students s JOIN users u ON u.id=s.user_id
      JOIN student_clearance sc ON sc.student_id=s.id AND sc.status='CLEARED'
      JOIN community_service_assignments a ON a.student_id=s.id
      WHERE u.is_active=TRUE AND NOT EXISTS(SELECT 1 FROM violations v WHERE v.student_id=s.id AND v.status='OPEN')
      GROUP BY s.id,sc.id HAVING BOOL_AND(a.status='COMPLETED' AND a.remaining_hours=0 AND a.completed_hours>=a.required_hours)
      ORDER BY s.last_name,s.first_name`);
    return res.json({ success: true, students: result.rows.map((row) => ({ ...row, id: Number(row.id), clearance_id: Number(row.clearance_id), required_hours: Number(row.required_hours), completed_hours: Number(row.completed_hours), student_name: studentName(row) })) });
  } catch (error) { return handle(res, error, 'Failed to load certificate eligibility'); }
};

const listSignatures = async (_req, res) => {
  try {
    const result = await pool.query(`SELECT id,officer_user_id,full_name,position,is_active,image_mime_type,
      'data:'||image_mime_type||';base64,'||encode(image_data,'base64') AS image_data_url,created_at,updated_at
      FROM discipline_officer_signatures ORDER BY is_active DESC,full_name`);
    return res.json({ success: true, signatures: result.rows });
  } catch (error) { return handle(res, error, 'Failed to load officer signatures'); }
};

const saveSignature = async (req, res) => {
  const client = await pool.connect();
  try {
    assertAllowedFields(req.body, ['officer_user_id', 'full_name', 'position', 'image_data_url', 'is_active']);
    const fullName = clean(req.body.full_name, 200);
    const position = clean(req.body.position || 'Discipline Officer', 120);
    if (!fullName || !position) throw new ApiError(400, 'VALIDATION_ERROR', 'Officer name and position are required');
    if (req.body.officer_user_id) {
      const officer = (await client.query("SELECT id FROM users WHERE id=$1 AND role IN ('ADMIN','DISCIPLINE_OFFICE')", [req.body.officer_user_id])).rows[0];
      if (!officer) throw new ApiError(400, 'INVALID_OFFICER', 'Selected officer is not authorized');
    }
    const image = parseSignatureImage(req.body.image_data_url);
    await client.query('BEGIN');
    const row = (await client.query(`INSERT INTO discipline_officer_signatures(officer_user_id,full_name,position,image_data,image_mime_type,is_active,created_by,updated_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$7) RETURNING id,full_name,position,is_active,image_mime_type,created_at,updated_at`,
      [req.body.officer_user_id || null, fullName, position, image.buffer, image.mimeType, req.body.is_active !== false, req.user.id])).rows[0];
    await audit(client, req.user.id, 'SIGNATURE_CREATE', 'discipline_officer_signatures', row.id, `Created e-signature for ${fullName}`, req.ip);
    await client.query('COMMIT');
    return res.status(201).json({ success: true, signature: row });
  } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} return handle(res, error, 'Failed to save officer signature'); }
  finally { client.release(); }
};

const updateSignature = async (req, res) => {
  const client = await pool.connect();
  try {
    assertAllowedFields(req.body, ['full_name', 'position', 'image_data_url', 'is_active']);
    if (!isPositiveId(req.params.id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid signature ID');
    await client.query('BEGIN');
    const current = (await client.query('SELECT * FROM discipline_officer_signatures WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
    if (!current) throw new ApiError(404, 'SIGNATURE_NOT_FOUND', 'Officer signature not found');
    const fullName = req.body.full_name === undefined ? current.full_name : clean(req.body.full_name, 200);
    const position = req.body.position === undefined ? current.position : clean(req.body.position, 120);
    if (!fullName || !position) throw new ApiError(400, 'VALIDATION_ERROR', 'Officer name and position are required');
    const image = req.body.image_data_url ? parseSignatureImage(req.body.image_data_url) : { buffer: current.image_data, mimeType: current.image_mime_type };
    const active = req.body.is_active === undefined ? current.is_active : req.body.is_active === true;
    const row = (await client.query(`UPDATE discipline_officer_signatures SET full_name=$2,position=$3,image_data=$4,image_mime_type=$5,is_active=$6,updated_by=$7,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id,full_name,position,is_active,image_mime_type,created_at,updated_at`,
      [current.id, fullName, position, image.buffer, image.mimeType, active, req.user.id])).rows[0];
    await audit(client, req.user.id, active ? 'SIGNATURE_UPDATE' : 'SIGNATURE_DEACTIVATE', 'discipline_officer_signatures', current.id, `Updated e-signature for ${fullName}`, req.ip);
    await client.query('COMMIT');
    return res.json({ success: true, signature: row });
  } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} return handle(res, error, 'Failed to update officer signature'); }
  finally { client.release(); }
};

const loadIssuanceSource = async (client, id) => {
  const row = (await client.query(`SELECT s.*,u.is_active,sc.id AS clearance_id,sc.status AS clearance_status,
    COALESCE(SUM(a.required_hours),0)::numeric AS required_hours,COALESCE(SUM(a.completed_hours),0)::numeric AS completed_hours,COUNT(a.id)::int AS assignment_count,
    BOOL_AND(a.status='COMPLETED' AND a.remaining_hours=0 AND a.completed_hours>=a.required_hours) AS service_complete,
    EXISTS(SELECT 1 FROM violations v WHERE v.student_id=s.id AND v.status='OPEN') AS has_open_violation
    FROM students s JOIN users u ON u.id=s.user_id JOIN student_clearance sc ON sc.student_id=s.id
    LEFT JOIN community_service_assignments a ON a.student_id=s.id WHERE s.id=$1 GROUP BY s.id,u.is_active,sc.id`, [id])).rows[0];
  if (!row) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  if (!row.is_active || row.clearance_status !== 'CLEARED' || row.assignment_count < 1 || !row.service_complete || row.has_open_violation) throw new ApiError(409, 'CERTIFICATE_NOT_ELIGIBLE', 'Student has incomplete service hours or unresolved required violations');
  const eligibility = await getStudentClearanceEligibility(row.id, client);
  if (!eligibility.eligible) throw new ApiError(409, 'CERTIFICATE_NOT_ELIGIBLE', 'Student is not currently eligible for a certificate');
  return row;
};

const issueCertificate = async (req, res) => {
  const client = await pool.connect();
  let certificate;
  try {
    assertAllowedFields(req.body, ['student_id', 'student_name', 'program', 'signature_ids']);
    if (!isPositiveId(req.body.student_id) || !Array.isArray(req.body.signature_ids) || !req.body.signature_ids.length || req.body.signature_ids.length > 3) throw new ApiError(400, 'VALIDATION_ERROR', 'Student and one to three signatures are required');
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(req.body.student_id)]);
    const source = await loadIssuanceSource(client, req.body.student_id);
    const ids = [...new Set(req.body.signature_ids.map(Number))];
    if (ids.some((id) => !Number.isInteger(id) || id < 1)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid signature selection');
    const signatures = (await client.query('SELECT id,full_name,position,image_data,image_mime_type FROM discipline_officer_signatures WHERE id=ANY($1::bigint[]) AND is_active=TRUE ORDER BY array_position($1::bigint[],id)', [ids])).rows;
    if (signatures.length !== ids.length) throw new ApiError(400, 'INVALID_SIGNATURE', 'Every selected signature must be active');
    const active = (await client.query("SELECT id FROM clearance_certificates WHERE student_id=$1 AND status='ISSUED' LIMIT 1", [source.id])).rows[0];
    if (active) throw new ApiError(409, 'CERTIFICATE_EXISTS', 'An issued certificate already exists; revoke it with a reason before issuing a correction');
    const version = Number((await client.query('SELECT COALESCE(MAX(version),0)+1 AS version FROM clearance_certificates WHERE student_id=$1', [source.id])).rows[0].version);
    const date = new Date().toISOString().slice(0, 10);
    const number = `STI-GC-COC-${date.replaceAll('-', '')}-${String(source.id).padStart(6, '0')}-V${version}`;
    const name = clean(req.body.student_name || studentName(source), 250);
    const program = clean(req.body.program || source.program, 200);
    if (!name || !program) throw new ApiError(400, 'VALIDATION_ERROR', 'Certificate name and program are required');
    const pdf = await renderCertificatePdf({ certificateNumber: number, studentName: name, program, completedHours: source.completed_hours, issueDate: date, signatures });
    certificate = (await client.query(`INSERT INTO clearance_certificates(student_id,clearance_id,certificate_number,version,student_name,student_number,program,completed_hours,issue_date,pdf_data,pdf_sha256,student_email,issued_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`, [source.id, source.clearance_id, number, version, name, source.student_number, program, source.completed_hours, date, pdf, crypto.createHash('sha256').update(pdf).digest('hex'), source.email || null, req.user.id])).rows[0];
    for (let index = 0; index < signatures.length; index += 1) await client.query(`INSERT INTO clearance_certificate_signatures(certificate_id,signature_id,display_order,officer_name,officer_position,signature_image,signature_mime_type) VALUES($1,$2,$3,$4,$5,$6,$7)`, [certificate.id, signatures[index].id, index + 1, signatures[index].full_name, signatures[index].position, signatures[index].image_data, signatures[index].image_mime_type]);
    await audit(client, req.user.id, 'CERTIFICATE_ISSUE', 'clearance_certificates', certificate.id, `Issued ${number} to student ${source.student_number}`, req.ip);
    await client.query('COMMIT');
    if (source.email) {
      try {
        await createEmailService().sendCertificate({ to: source.email, studentName: name, certificateNumber: number, pdf });
        certificate = (await pool.query("UPDATE clearance_certificates SET email_status='SENT',emailed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [certificate.id])).rows[0];
        await pool.query("INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address) VALUES($1,'CERTIFICATE_EMAIL_SENT','clearance_certificates',$2,$3,$4)", [req.user.id, certificate.id, `Emailed ${number} to the registered student email`, req.ip || null]);
      } catch (error) {
        certificate = (await pool.query("UPDATE clearance_certificates SET email_status='FAILED',email_error=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [certificate.id, clean(error.message, 500)])).rows[0];
      }
    } else certificate = (await pool.query("UPDATE clearance_certificates SET email_status='FAILED',email_error='No registered student email',updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [certificate.id])).rows[0];
    return res.status(201).json({ success: true, certificate: publicCertificate(certificate) });
  } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} return handle(res, error, 'Failed to issue clearance certificate'); }
  finally { client.release(); }
};

const listCertificates = async (req, res) => {
  try {
    const mine = req.user.role === 'STUDENT';
    const result = await pool.query(`SELECT cc.* FROM clearance_certificates cc ${mine ? 'JOIN students s ON s.id=cc.student_id WHERE s.user_id=$1' : ''} ORDER BY cc.created_at DESC`, mine ? [req.user.id] : []);
    return res.json({ success: true, certificates: result.rows.map(publicCertificate) });
  } catch (error) { return handle(res, error, 'Failed to load certificates'); }
};

const getMyClearanceCertificate = async (req, res) => {
  try {
    const row = (await pool.query(`SELECT cc.* FROM clearance_certificates cc JOIN students s ON s.id=cc.student_id
      WHERE s.user_id=$1 AND cc.status='ISSUED' ORDER BY cc.created_at DESC LIMIT 1`, [req.user.id])).rows[0];
    if (!row) throw new ApiError(404, 'CERTIFICATE_NOT_FOUND', 'No issued clearance certificate is available');
    return res.json({ success: true, certificate: publicCertificate(row) });
  } catch (error) { return handle(res, error, 'Failed to load certificate'); }
};

const downloadCertificate = async (req, res) => {
  try {
    if (!isPositiveId(req.params.id)) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid certificate ID');
    const mine = req.user.role === 'STUDENT';
    const result = await pool.query(`SELECT cc.id,cc.certificate_number,cc.pdf_data FROM clearance_certificates cc ${mine ? 'JOIN students s ON s.id=cc.student_id' : ''} WHERE cc.id=$1 ${mine ? 'AND s.user_id=$2' : ''}`, mine ? [req.params.id, req.user.id] : [req.params.id]);
    if (!result.rows[0]) throw new ApiError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate not found');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${result.rows[0].certificate_number}.pdf"`, 'Cache-Control': 'private, no-store' });
    return res.send(result.rows[0].pdf_data);
  } catch (error) { return handle(res, error, 'Failed to download certificate'); }
};

const revokeCertificate = async (req, res) => {
  const client = await pool.connect();
  try {
    assertAllowedFields(req.body, ['reason']);
    const reason = clean(req.body.reason, 1000);
    if (!reason) throw new ApiError(400, 'VALIDATION_ERROR', 'A revocation reason is required');
    await client.query('BEGIN');
    const row = (await client.query("UPDATE clearance_certificates SET status='REVOKED',revoked_by=$2,revoked_at=CURRENT_TIMESTAMP,revocation_reason=$3,updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND status='ISSUED' RETURNING *", [req.params.id, req.user.id, reason])).rows[0];
    if (!row) throw new ApiError(404, 'CERTIFICATE_NOT_FOUND', 'Issued certificate not found');
    await audit(client, req.user.id, 'CERTIFICATE_REVOKE', 'clearance_certificates', row.id, `Revoked ${row.certificate_number}: ${reason}`, req.ip);
    await client.query('COMMIT');
    return res.json({ success: true, certificate: publicCertificate(row) });
  } catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} return handle(res, error, 'Failed to revoke certificate'); }
  finally { client.release(); }
};

const resendCertificate = async (req, res) => {
  try {
    const row = (await pool.query("SELECT * FROM clearance_certificates WHERE id=$1 AND status='ISSUED'", [req.params.id])).rows[0];
    if (!row) throw new ApiError(404, 'CERTIFICATE_NOT_FOUND', 'Issued certificate not found');
    if (!row.student_email) throw new ApiError(409, 'EMAIL_UNAVAILABLE', 'Student has no registered email');
    await createEmailService().sendCertificate({ to: row.student_email, studentName: row.student_name, certificateNumber: row.certificate_number, pdf: row.pdf_data });
    const updated = (await pool.query("UPDATE clearance_certificates SET email_status='SENT',email_error=NULL,emailed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *", [row.id])).rows[0];
    await pool.query("INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address) VALUES($1,'CERTIFICATE_EMAIL_SENT','clearance_certificates',$2,$3,$4)", [req.user.id, row.id, `Re-sent ${row.certificate_number} to registered student email`, req.ip || null]);
    return res.json({ success: true, certificate: publicCertificate(updated) });
  } catch (error) { return handle(res, error, 'Failed to email certificate'); }
};

const verifyClearanceCertificate = async (req, res) => {
  try {
    const id = clearanceIdFromCode(req.params.code);
    if (!id) throw new ApiError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate is invalid');
    const row = (await pool.query('SELECT * FROM clearance_certificates WHERE id=$1', [id])).rows[0];
    if (!row) throw new ApiError(404, 'CERTIFICATE_NOT_FOUND', 'Certificate is invalid');
    const certificate = publicCertificate(row);
    certificate.student_number = certificate.student_number ? `${'*'.repeat(Math.max(certificate.student_number.length - 4, 0))}${certificate.student_number.slice(-4)}` : null;
    delete certificate.student_email;
    return res.json({ success: true, certificate, valid: row.status === 'ISSUED' });
  } catch (error) { return handle(res, error, 'Failed to verify certificate'); }
};

module.exports = { getEligibleStudents, listSignatures, saveSignature, updateSignature, issueCertificate, listCertificates, downloadCertificate, revokeCertificate, resendCertificate, getMyClearanceCertificate, verifyClearanceCertificate };
