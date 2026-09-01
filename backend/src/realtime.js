const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('./config/database');
const { getJwtSecret } = require('./services/sessionTokenService');

let io = null;

const room = {
  user: (id) => `user:${Number(id)}`,
  role: (roleName) => `role:${roleName}`,
  department: (id) => `department:${Number(id)}`
};

const initializeRealtime = (httpServer, allowedOrigins) => {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins, credentials: true, methods: ['GET', 'POST'] }
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, getJwtSecret());
      const account = (await pool.query(
        `SELECT u.id,u.role,u.session_version,u.must_change_password,dh.department_id
         FROM users u LEFT JOIN department_heads dh ON dh.user_id=u.id
         WHERE u.id=$1 AND u.is_active=TRUE LIMIT 1`,
        [decoded.id]
      )).rows[0];
      if (!account || Number(decoded.session_version) !== Number(account.session_version)) {
        return next(new Error('Invalid or expired session'));
      }
      if (account.must_change_password) return next(new Error('Password change required'));
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
    if (socket.user.role === 'DEPARTMENT_HEAD' && socket.user.department_id) {
      socket.join(room.department(socket.user.department_id));
    }
  });
  return io;
};

const emitToUser = (userId, event, payload = {}) => io?.to(room.user(userId)).emit(event, payload);
const emitToRole = (roleName, event, payload = {}) => io?.to(room.role(roleName)).emit(event, payload);
const emitToDepartment = (departmentId, event, payload = {}) => io?.to(room.department(departmentId)).emit(event, payload);

module.exports = { initializeRealtime, emitToUser, emitToRole, emitToDepartment, room };
