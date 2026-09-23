const { Server } = require('socket.io');
const pool = require('./config/database');
const sessions = require('./services/browserSessionService');

let io = null;

const room = {
  user: (id) => `user:${Number(id)}`,
  role: (roleName) => `role:${roleName}`,
  department: (id) => `department:${Number(id)}`
};

const initializeRealtime = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] },
    allowRequest:(req,callback)=>callback(null,!req.headers.origin||allowedOrigins.includes(req.headers.origin)),
    maxHttpBufferSize:100000,
    pingTimeout:20000
  });

  io.use(async (socket, next) => {
    try {
      const token = sessions.parseCookies(socket.handshake.headers.cookie)[sessions.COOKIE_NAME];
      if (!token) return next(new Error('Authentication required'));
      const account = (await pool.query(
        `SELECT u.id,u.role,u.must_change_password,s.onboarding_required,s.onboarding_completed_at,COALESCE(dh.department_id,sp.department_id) AS department_id
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
      socket.user = {
        id: Number(account.id), role: account.role,
        department_id: account.department_id ? Number(account.department_id) : null
      };
      return next();
    } catch (_) {
      return next(new Error('Invalid or expired session'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(room.user(socket.user.id));
    socket.join(room.role(socket.user.role));
    if (['DEPARTMENT_HEAD', 'DISCIPLINE_OFFICE'].includes(socket.user.role) && socket.user.department_id) {
      socket.join(room.department(socket.user.department_id));
    }
  });
  return io;
};

const emitToUser = (userId, event, payload = {}) => io?.to(room.user(userId)).emit(event, payload);
const emitToRole = (roleName, event, payload = {}) => io?.to(room.role(roleName)).emit(event, payload);
const emitToDepartment = (departmentId, event, payload = {}) => io?.to(room.department(departmentId)).emit(event, payload);

module.exports = { initializeRealtime, emitToUser, emitToRole, emitToDepartment, room };
