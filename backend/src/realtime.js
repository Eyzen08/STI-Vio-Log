const { Server } = require('socket.io');
const pool = require('./config/database');
const sessions = require('./services/browserSessionService');

let io = null;
let authorizationRefreshTimer = null;

const room = {
  user: (id) => `user:${Number(id)}`,
  role: (roleName) => `role:${roleName}`,
  department: (id) => `department:${Number(id)}`
};

const authorizationQuery = `SELECT bs.id AS browser_session_id,u.id,u.role,u.must_change_password,
  s.onboarding_required,s.onboarding_completed_at,COALESCE(dh.department_id,sp.department_id) AS department_id
  FROM browser_sessions bs JOIN users u ON u.id=bs.user_id
  LEFT JOIN department_heads dh ON dh.user_id=u.id
  LEFT JOIN staff_profiles sp ON sp.user_id=u.id
  LEFT JOIN students s ON s.user_id=u.id
  WHERE bs.id=$1 AND bs.revoked_at IS NULL AND bs.idle_expires_at>CURRENT_TIMESTAMP
    AND bs.absolute_expires_at>CURRENT_TIMESTAMP AND u.is_active=TRUE LIMIT 1`;

const authorizedDepartment = (account) => ['DEPARTMENT_HEAD', 'DISCIPLINE_OFFICE'].includes(account.role) && account.department_id
  ? Number(account.department_id)
  : null;

const normalizedAuthorization = (account) => account && !account.must_change_password
  && !(account.role === 'STUDENT' && account.onboarding_required && !account.onboarding_completed_at)
  ? { session_id:Number(account.browser_session_id), id:Number(account.id), role:account.role, department_id:authorizedDepartment(account) }
  : null;

const loadSocketAuthorization = async (sessionId, database = pool) => normalizedAuthorization((await database.query(authorizationQuery, [Number(sessionId)])).rows[0]);

const authorizationRooms = (user) => [room.user(user.id), room.role(user.role), ...(user.department_id ? [room.department(user.department_id)] : [])];

const synchronizeSocketAuthorization = async (socket, database = pool) => {
  const current = await loadSocketAuthorization(socket.data.sessionId, database);
  if (!current) {
    console.info(JSON.stringify({ level:'info', event:'realtime_forced_disconnect', user_id:socket.user?.id || null, reason:'authorization_invalid' }));
    socket.disconnect(true);
    return null;
  }
  if (socket.user) for (const previousRoom of authorizationRooms(socket.user)) if (!authorizationRooms(current).includes(previousRoom)) await socket.leave(previousRoom);
  for (const nextRoom of authorizationRooms(current)) await socket.join(nextRoom);
  socket.user = current;
  return current;
};

const initializeRealtime = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
    allowRequest:(req,callback)=>callback(null,Boolean(req.headers.origin&&allowedOrigins.includes(req.headers.origin))),
    maxHttpBufferSize:100000,
    pingTimeout:20000
  });

  io.use(async (socket, next) => {
    try {
      const token = sessions.parseCookies(socket.handshake.headers.cookie)[sessions.COOKIE_NAME];
      if (!token) return next(new Error('Authentication required'));
      const account = (await pool.query(
        `SELECT bs.id AS browser_session_id,u.id,u.role,u.must_change_password,s.onboarding_required,s.onboarding_completed_at,COALESCE(dh.department_id,sp.department_id) AS department_id
         FROM browser_sessions bs JOIN users u ON u.id=bs.user_id
         LEFT JOIN department_heads dh ON dh.user_id=u.id
         LEFT JOIN staff_profiles sp ON sp.user_id=u.id
         LEFT JOIN students s ON s.user_id=u.id
         WHERE bs.token_hash=$1 AND bs.revoked_at IS NULL AND bs.idle_expires_at>CURRENT_TIMESTAMP
           AND bs.absolute_expires_at>CURRENT_TIMESTAMP AND u.is_active=TRUE LIMIT 1`,
        [sessions.hash(token)]
      )).rows[0];
      if (!account) {
        return next(new Error('Invalid or expired session'));
      }
      if (account.must_change_password) return next(new Error('Password change required'));
      if (account.role==='STUDENT' && account.onboarding_required && !account.onboarding_completed_at) return next(new Error('Student onboarding required'));
      socket.data.sessionId = Number(account.browser_session_id);
      socket.user = normalizedAuthorization(account);
      return next();
    } catch (_) {
      return next(new Error('Invalid or expired session'));
    }
  });

  io.on('connection', (socket) => {
    for (const authorizedRoom of authorizationRooms(socket.user)) socket.join(authorizedRoom);
  });
  if (authorizationRefreshTimer) clearInterval(authorizationRefreshTimer);
  authorizationRefreshTimer = setInterval(async () => {
    if (!io) return;
    const sockets = await io.fetchSockets();
    await Promise.all(sockets.map((socket) => synchronizeSocketAuthorization(socket).catch(() => socket.disconnect(true))));
  }, 15000);
  authorizationRefreshTimer.unref?.();
  return io;
};

const emitToAuthorizedRoom = async (roomName, event, payload = {}) => {
  if (!io) return 0;
  try {
    const sockets = await io.in(roomName).fetchSockets();
    await Promise.all(sockets.map(async (socket) => {
      const authorization = await synchronizeSocketAuthorization(socket);
      if (authorization && socket.rooms.has(roomName)) socket.emit(event, payload);
    }));
    return sockets.length;
  } catch (_) {
    console.error(JSON.stringify({ level:'error', event:'realtime_authorization_refresh_failed', room:roomName }));
    return 0;
  }
};

const emitToUser = (userId, event, payload = {}) => emitToAuthorizedRoom(room.user(userId), event, payload);
const emitToRole = (roleName, event, payload = {}) => emitToAuthorizedRoom(room.role(roleName), event, payload);
const emitToDepartment = (departmentId, event, payload = {}) => emitToAuthorizedRoom(room.department(departmentId), event, payload);

const disconnectUserSockets = async (userId, reason = 'security_state_changed') => {
  if (!io) return 0;
  const sockets = await io.in(room.user(userId)).fetchSockets();
  for (const socket of sockets) socket.disconnect(true);
  if (sockets.length) console.info(JSON.stringify({ level:'info', event:'realtime_forced_disconnect', user_id:Number(userId), reason, socket_count:sockets.length }));
  return sockets.length;
};

module.exports = { initializeRealtime, emitToUser, emitToRole, emitToDepartment, disconnectUserSockets, loadSocketAuthorization, synchronizeSocketAuthorization, room };
