const crypto = require('node:crypto');
const { ApiError } = require('../utils/api');
const { isPositiveId } = require('../utils/validators');
const { parseSignatureImage } = require('./clearanceCertificateService');

const PRESET_IDS = Object.freeze(Array.from({ length: 48 }, (_, index) => `portrait-${String(index + 1).padStart(2, '0')}`));
const photoUrl = (id, revision) => revision ? `/api/avatars/${Number(id)}/photo?v=${revision}` : null;
const avatarMetadata = (row = {}) => ({
  source: row.avatar_source || 'INITIALS',
  preset_id: row.avatar_preset_id || null,
  photo_url: photoUrl(row.id, row.avatar_photo_revision)
});

// Only metadata is selected; photo bytes never enter directory/session responses.
const avatarSql = (userId) => `(SELECT json_build_object('source', au.avatar_source, 'preset_id', au.avatar_preset_id,
  'photo_url', CASE WHEN au.avatar_photo_revision IS NOT NULL THEN '/api/avatars/' || au.id || '/photo?v=' || au.avatar_photo_revision ELSE NULL END)
  FROM users au WHERE au.id=${userId})`;

const validateSelection = ({ source, preset_id }, hasPhoto) => {
  if (!['INITIALS', 'PRESET', 'PHOTO'].includes(source)) throw new ApiError(400, 'INVALID_AVATAR', 'Choose initials, a preset avatar, or your uploaded photo');
  if (preset_id != null && !PRESET_IDS.includes(preset_id)) throw new ApiError(400, 'INVALID_AVATAR', 'Choose an available preset avatar');
  if (source === 'PRESET' && !PRESET_IDS.includes(preset_id)) throw new ApiError(400, 'INVALID_AVATAR', 'Choose an available preset avatar');
  if (source === 'PHOTO' && !hasPhoto) throw new ApiError(400, 'AVATAR_PHOTO_UNAVAILABLE', 'No student photo is available');
};

const parseAvatarImage = (value) => {
  if (typeof value !== 'string' || value.length > 1_400_000) throw new ApiError(400, 'INVALID_AVATAR_IMAGE', 'Upload a PNG or JPEG image of 1 MB or smaller');
  try { return parseSignatureImage(value); }
  catch (error) {
    if (!error.statusCode) throw error;
    throw new ApiError(400, 'INVALID_AVATAR_IMAGE', error.message.replace(/signature /g, ''));
  }
};

const validateReason = (value) => {
  const reason = typeof value === 'string' ? value.trim() : '';
  if (!reason || reason.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(reason)) throw new ApiError(400, 'VALIDATION_ERROR', 'Enter a photo change reason of 1 to 1000 characters');
  return reason;
};

const createAvatarService = ({ pool }) => {
  const get = async (userId, executor = pool) => {
    const row = (await executor.query('SELECT id,avatar_source,avatar_preset_id,avatar_photo_revision FROM users WHERE id=$1', [userId])).rows[0];
    if (!row) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    return avatarMetadata(row);
  };
  const transaction = async (work) => {
    const client = await pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { try { await client.query('ROLLBACK'); } catch (_) {} throw error; }
    finally { client.release(); }
  };
  const audit = (client, actor, targetId, action, description, ip) => client.query(
    'INSERT INTO audit_logs(user_id,action,table_name,record_id,description,ip_address) VALUES($1,$2,\'users\',$3,$4,$5)',
    [actor.id, action, targetId, description, ip || null]);

  const select = (actor, selection, ip) => transaction(async (client) => {
    const row = (await client.query('SELECT id,role,avatar_photo_revision FROM users WHERE id=$1 FOR UPDATE', [actor.id])).rows[0];
    if (!row) throw new ApiError(404, 'ACCOUNT_NOT_FOUND', 'Account not found');
    validateSelection(selection, row.role === 'STUDENT' && Boolean(row.avatar_photo_revision));
    await client.query(`UPDATE users SET avatar_source=$2,avatar_preset_id=COALESCE($3,avatar_preset_id),updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [actor.id, selection.source, selection.preset_id || null]);
    await audit(client, actor, actor.id, 'AVATAR_SELECT', `Selected ${selection.source.toLowerCase()} avatar`, ip);
    return get(actor.id, client);
  });

  const changePhoto = async (actor, studentId, body, remove, ip) => {
    if (!['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'].includes(actor.role)) throw new ApiError(403, 'FORBIDDEN', 'Only authorized office staff can manage student photos');
    if (!isPositiveId(studentId)) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid student ID is required');
    const reason = validateReason(body.reason);
    const image = remove ? null : parseAvatarImage(body.image_data_url);
    return transaction(async (client) => {
      // Selection and photo changes use the same user lock to serialize races.
      const row = (await client.query(`SELECT u.id FROM students s JOIN users u ON u.id=s.user_id AND u.role='STUDENT' WHERE s.id=$1 FOR UPDATE OF u`, [Number(studentId)])).rows[0];
      if (!row) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student account not found');
      if (remove) {
        await client.query('DELETE FROM user_avatar_photos WHERE user_id=$1', [row.id]);
        await client.query(`UPDATE users SET avatar_photo_revision=NULL,
          avatar_source=CASE WHEN avatar_source='PHOTO' THEN CASE WHEN avatar_preset_id IS NULL THEN 'INITIALS' ELSE 'PRESET' END ELSE avatar_source END,
          updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [row.id]);
      } else {
        await client.query(`INSERT INTO user_avatar_photos(user_id,image_data,image_mime_type) VALUES($1,$2,$3)
          ON CONFLICT(user_id) DO UPDATE SET image_data=EXCLUDED.image_data,image_mime_type=EXCLUDED.image_mime_type,updated_at=CURRENT_TIMESTAMP`, [row.id, image.buffer, image.mimeType]);
        await client.query(`UPDATE users SET avatar_source='PHOTO',avatar_photo_revision=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [row.id, crypto.randomUUID()]);
      }
      await audit(client, actor, row.id, remove ? 'STUDENT_AVATAR_REMOVE' : 'STUDENT_AVATAR_UPLOAD', `${remove ? 'Removed' : 'Uploaded'} student photo: ${reason}`, ip);
      return { student_id: Number(studentId), avatar: await get(row.id, client) };
    });
  };

  const readPhoto = async (actor, userId, revision) => {
    if (!isPositiveId(userId)) throw new ApiError(404, 'AVATAR_NOT_FOUND', 'Photo not found');
    let permitted = Number(actor.id) === Number(userId) || ['DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'].includes(actor.role);
    if (!permitted && actor.role === 'DEPARTMENT_HEAD' && actor.department_id) {
      permitted = Boolean((await pool.query(`SELECT 1 FROM community_service_sessions css
        JOIN community_service_assignments a ON a.id=css.assignment_id JOIN students s ON s.id=a.student_id
        JOIN departments d ON d.id=css.department_id AND d.is_active=TRUE
        WHERE s.user_id=$1 AND css.department_id=$2 LIMIT 1`, [Number(userId), actor.department_id])).rows[0]);
    }
    if (!permitted) throw new ApiError(404, 'AVATAR_NOT_FOUND', 'Photo not found');
    const row = (await pool.query(`SELECT p.image_data,p.image_mime_type,u.avatar_photo_revision FROM user_avatar_photos p
      JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`, [Number(userId)])).rows[0];
    if (!row || (revision && revision !== row.avatar_photo_revision)) throw new ApiError(404, 'AVATAR_NOT_FOUND', 'Photo not found');
    return row;
  };
  return { get, select, changePhoto, readPhoto };
};

module.exports = { PRESET_IDS, avatarMetadata, avatarSql, validateSelection, parseAvatarImage, validateReason, createAvatarService };
