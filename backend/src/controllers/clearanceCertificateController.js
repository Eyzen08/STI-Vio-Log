const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { certificateCode, clearanceIdFromCode } = require('../services/clearanceCertificateService');
const { getStudentClearanceEligibility } = require('./clearanceController');

const certificateQuery = `SELECT sc.id, sc.student_id, sc.academic_year, sc.semester, sc.status, sc.cleared_at,
  s.student_number, s.first_name, s.middle_name, s.last_name, s.suffix
  FROM student_clearance sc JOIN students s ON s.id = sc.student_id`;

const publicCertificate = (row) => ({
  certificate_code: certificateCode(row.id),
  student_number: row.student_number,
  student_name: [row.first_name, row.middle_name, row.last_name, row.suffix].filter(Boolean).join(' '),
  academic_year: row.academic_year,
  semester: row.semester,
  cleared_at: row.cleared_at,
  status: 'VALID'
});

const requireLiveClearance = async (row) => {
  if (!row || row.status !== 'CLEARED' || !row.cleared_at) return false;
  const eligibility = await getStudentClearanceEligibility(row.student_id);
  return eligibility.eligible;
};

const getMyClearanceCertificate = async (req, res) => {
  try {
    assertAllowedFields(req.query, []);
    const result = await pool.query(`${certificateQuery} WHERE s.user_id = $1 AND sc.status = 'CLEARED' ORDER BY sc.cleared_at DESC, sc.id DESC LIMIT 1`, [req.user.id]);
    const row = result.rows[0];
    if (!(await requireLiveClearance(row))) return res.status(409).json({ success: false, message: 'A current approved clearance with no active blockers is required' });
    return res.json({ success: true, certificate: publicCertificate(row) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Failed to prepare clearance certificate' });
  }
};

const verifyClearanceCertificate = async (req, res) => {
  try {
    assertAllowedFields(req.query, []);
    const id = clearanceIdFromCode(req.params.code);
    if (!id) return res.status(404).json({ success: false, message: 'Certificate is invalid or no longer current' });
    const row = (await pool.query(`${certificateQuery} WHERE sc.id = $1 LIMIT 1`, [id])).rows[0];
    if (!(await requireLiveClearance(row))) return res.status(404).json({ success: false, message: 'Certificate is invalid or no longer current' });
    return res.json({ success: true, certificate: publicCertificate(row) });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Failed to verify clearance certificate' });
  }
};

module.exports = { getMyClearanceCertificate, verifyClearanceCertificate };
