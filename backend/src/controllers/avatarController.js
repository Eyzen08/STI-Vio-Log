const pool = require('../config/database');
const { assertAllowedFields } = require('../utils/validators');
const { sendError } = require('../utils/api');
const { createAvatarService, PRESET_IDS } = require('../services/avatarService');

const createAvatarController = ({ service = createAvatarService({ pool }) } = {}) => {
  const run = (handler) => async (req, res) => {
    try { return await handler(req, res); }
    catch (error) { return sendError(res, error.statusCode || 500, error.code || 'INTERNAL_ERROR', error.statusCode ? error.message : 'Unable to update avatar'); }
  };
  return {
    get: run(async (req, res) => res.json({ success: true, avatar: await service.get(req.user.id), preset_ids: PRESET_IDS })),
    select: run(async (req, res) => {
      assertAllowedFields(req.body, ['source', 'preset_id']);
      return res.json({ success: true, avatar: await service.select(req.user, req.body, req.ip) });
    }),
    upload: run(async (req, res) => {
      assertAllowedFields(req.body, ['image_data_url', 'reason']);
      return res.json({ success: true, ...await service.changePhoto(req.user, req.params.id, req.body, false, req.ip) });
    }),
    remove: run(async (req, res) => {
      assertAllowedFields(req.body, ['reason']);
      return res.json({ success: true, ...await service.changePhoto(req.user, req.params.id, req.body, true, req.ip) });
    }),
    photo: run(async (req, res) => {
      const photo = await service.readPhoto(req.user, req.params.userId, req.query.v);
      return res.set('Cache-Control', 'private, no-store').set('Content-Type', photo.image_mime_type)
        .set('X-Content-Type-Options', 'nosniff').send(photo.image_data);
    })
  };
};
module.exports = { createAvatarController, ...createAvatarController() };
