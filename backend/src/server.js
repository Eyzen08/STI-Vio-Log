require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require('node:crypto');

const studentRoutes = require("./routes/studentRoutes");
const authRoutes = require("./routes/authRoutes");
const departmentHeadRoutes = require("./routes/departmentHeadRoutes");
const violationRoutes = require("./routes/violationRoutes");
const communityServiceRoutes = require("./routes/communityServiceRoutes");
const qrRoutes = require("./routes/qrRoutes");
const clearanceRoutes = require("./routes/clearanceRoutes");
const studentClearanceRoutes = require("./routes/studentClearanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const auditRoutes = require("./routes/auditRoutes");
const googleRegistrationRoutes = require("./routes/googleRegistrationRoutes");
const parentContactRoutes = require('./routes/parentContactRoutes');
const accountRoutes = require('./routes/accountRoutes');
const accountAdministrationRoutes = require('./routes/accountAdministrationRoutes');
const departmentAdministrationRoutes = require('./routes/departmentAdministrationRoutes');
const googleLinkAdministrationRoutes = require('./routes/googleLinkAdministrationRoutes');
const duplicateAccountReviewRoutes = require('./routes/duplicateAccountReviewRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const messageRoutes = require('./routes/messageRoutes');
const officerResponsibilityRoutes = require('./routes/officerResponsibilityRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { auditAdministrativeRequest } = require('./middleware/administrativeAuditMiddleware');
const systemAdministrationRoutes = require('./routes/systemAdministrationRoutes');
const highRiskActionRoutes = require('./routes/highRiskActionRoutes');
const officerResponsibilityController = require('./controllers/officerResponsibilityController');
const pool = require("./config/database");
const { allowedOriginsFor, CORS_METHODS, enforceHttps, validateSecureConfig } = require('./config/security');
const { errorHandler, notFoundHandler, normalizeErrorResponses } = require("./utils/api");
const { initializeRealtime, emitToRole } = require('./realtime');
const { createOverdueAttendanceNotifications } = require('./services/notificationService');

const {
  authenticateToken,
  authorizeRoles,
  authorizePermissions
} = require("./middleware/authMiddleware");
const { PERMISSIONS } = require('./security/permissions');

const app = express();

if (process.env.NODE_ENV === 'production') app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

const PORT = process.env.PORT || 5000;


// =====================================================
// SECURE CONFIGURATION VALIDATION
// =====================================================

// =====================================================
// VALIDATE CONFIG BEFORE SERVER START
// =====================================================

try {
  validateSecureConfig();
} catch (error) {
  console.error(
    "🚫 Startup blocked:",
    error.message
  );

  process.exit(1);
}


// =====================================================
// RATE LIMITER
// =====================================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many requests, please try again later."
  }
});


// =====================================================
// CORS
// =====================================================

const allowedOrigins = allowedOriginsFor(process.env);


// =====================================================
// GLOBAL MIDDLEWARE
// =====================================================

app.use(enforceHttps(process.env));

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "same-site"
    },
    contentSecurityPolicy:{directives:{defaultSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'none'"]}},
    referrerPolicy:{policy:'no-referrer'}
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      const corsError = new Error("Origin not allowed by CORS");
      corsError.statusCode = 403;
      corsError.code = 'CORS_ORIGIN_DENIED';
      callback(corsError);
    },

    credentials: true,

    methods: CORS_METHODS,

    allowedHeaders: [
      "Content-Type",
      "X-CSRF-Token",
      "X-Request-ID"
    ]
  })
);

app.use((req,res,next)=>{
  if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
  const origin=req.get('origin');
  if(origin&&!allowedOrigins.includes(origin))return res.status(403).json({success:false,message:'Untrusted request origin',error:{code:'ORIGIN_DENIED',message:'Untrusted request origin'}});
  return next();
});

// Signature images are validated as PNG/JPEG <= 1 MB by the controller. Their
// Base64 envelope needs a narrowly scoped parser larger than the API default.
app.use(/^\/api\/clearance\/signatures(?:\/\d+)?$/, express.json({ limit: "1500kb" }));
app.use(express.json({ limit: "128kb" }));

app.use((req,res,next)=>{
  const supplied=req.get('x-request-id');
  req.requestId=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(supplied||'')?supplied:crypto.randomUUID();
  res.set('x-request-id',req.requestId);
  next();
});

app.use(apiLimiter);
app.use(normalizeErrorResponses);


// =====================================================
// PUBLIC AUTH ROUTES
// =====================================================

app.use(
  "/api",
  authRoutes
);

app.use('/api/certificates', certificateRoutes);
app.use('/api/messages', authenticateToken, auditAdministrativeRequest, messageRoutes);
app.use('/api/notifications', authenticateToken, authorizeRoles('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT'), notificationRoutes);

app.use('/api/account', authenticateToken, accountRoutes);
app.use('/api/system', authenticateToken, systemAdministrationRoutes);
app.use('/api/high-risk-actions', authenticateToken, auditAdministrativeRequest, highRiskActionRoutes);

app.use('/api/admin/accounts', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.STAFF_ACCOUNT_MANAGE), accountAdministrationRoutes);
app.use('/api/department-accounts', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.STAFF_ACCOUNT_MANAGE), require('./routes/departmentAccountRoutes'));
app.use('/api/admin/departments', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.DEPARTMENT_MANAGE), departmentAdministrationRoutes);
app.use('/api/admin/officer-responsibilities', authenticateToken, auditAdministrativeRequest, authorizePermissions(PERMISSIONS.OFFICER_ASSIGNMENT_MANAGE), officerResponsibilityRoutes);
app.get('/api/officer-responsibilities/available', authenticateToken, authorizeRoles('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD'), officerResponsibilityController.available);
app.use('/api/admin/students', authenticateToken, authorizeRoles('DISCIPLINE_ADMIN', 'DISCIPLINE_OFFICE'), googleLinkAdministrationRoutes);
app.use('/api/admin/duplicate-review', authenticateToken, authorizePermissions(PERMISSIONS.STUDENT_REGISTRATION_REVIEW), authorizeRoles('DISCIPLINE_ADMIN'), duplicateAccountReviewRoutes);


// =====================================================
// STUDENT ROUTES
// =====================================================
//
// Accessible by:
// - ADMIN
// - DISCIPLINE_OFFICE
// - DEPARTMENT_HEAD
// - STUDENT
//
// Student-specific controllers must still use
// req.user.id when accessing personal records.
// =====================================================

app.use(
  "/api/students",
  authenticateToken,
  auditAdministrativeRequest,
  authorizeRoles(
    "DISCIPLINE_ADMIN",
    "DISCIPLINE_OFFICE",
    "STUDENT"
  ),
  studentRoutes
);


// =====================================================
// DEPARTMENT HEAD MANAGEMENT
// =====================================================

app.use(
  "/api/department-heads",
  authenticateToken,
  authorizeRoles(
    "DISCIPLINE_ADMIN"
  ),
  departmentHeadRoutes
);


// =====================================================
// VIOLATIONS
// =====================================================
//
// Students cannot directly create/update/delete
// violation records.
// =====================================================

app.use(
  "/api/violations",
  authenticateToken,
  auditAdministrativeRequest,
  violationRoutes
);


// =====================================================
// COMMUNITY SERVICE
// =====================================================

// -----------------------------------------------------
// STAFF / ADMIN COMMUNITY SERVICE
// -----------------------------------------------------
// ADMIN
// DISCIPLINE_OFFICE
// DEPARTMENT_HEAD
//
// Students cannot access these management endpoints.
// -----------------------------------------------------

app.use(
  "/api/community-service",
  authenticateToken,
  auditAdministrativeRequest,
  communityServiceRoutes
);

app.use(
  "/api/parent-contact",
  authenticateToken,
  auditAdministrativeRequest,
  parentContactRoutes
);


// =====================================================
// QR
// =====================================================

app.use(
  "/api/qr",
  authenticateToken,
  auditAdministrativeRequest,
  qrRoutes
);


// =====================================================
// GENERAL CLEARANCE
// =====================================================
//
// Used by:
// - ADMIN
// - DISCIPLINE_OFFICE
// - DEPARTMENT_HEAD
//
// Students do NOT have access here.
// They use /api/student/clearance instead.
// =====================================================

app.use(
  "/api/clearance",
  authenticateToken,
  auditAdministrativeRequest,
  clearanceRoutes
);


// =====================================================
// STUDENT'S OWN CLEARANCE
// =====================================================
//
// STUDENT ONLY.
//
// The controller uses req.user.id and the
// students.user_id relationship.
// =====================================================

app.use(
  "/api/student/clearance",
  authenticateToken,
  authorizeRoles("STUDENT"),
  studentClearanceRoutes
);


// =====================================================
// REPORTS
// =====================================================

app.use(
  "/api/reports",
  reportRoutes
);


// =====================================================
// AUDIT LOGS
// =====================================================

app.use(
  "/api/audit-logs",
  authenticateToken,
  auditRoutes
);

app.use(
  "/api/google-registrations",
  authenticateToken,
  authorizeRoles("DISCIPLINE_ADMIN", "DISCIPLINE_OFFICE"),
  googleRegistrationRoutes
);



// =====================================================
// ROOT TEST ROUTE
// =====================================================

app.get(
  "/",
  (req, res) => {
    return res.json({
      success: true,
      message:
        "STI Vio-Log API is running"
    });
  }
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/health",
  async (req, res) => {
    try {
      await pool.query("SELECT 1 AS healthy");
      return res.json({ success: true, status: "ok", database: "connected" });
    } catch (error) {
      console.error("Health check database error:", error);
      return res.status(503).json({ success: false, status: "degraded", database: "unavailable", error: { code: "DATABASE_UNAVAILABLE", message: "Database connectivity check failed" } });
    }
  }
);

app.use(notFoundHandler);
app.use(errorHandler);


// =====================================================
// START SERVER
// =====================================================

if (require.main === module) {
const httpServer = http.createServer(app);
httpServer.requestTimeout=30000;
httpServer.headersTimeout=15000;
httpServer.keepAliveTimeout=5000;
initializeRealtime(httpServer, allowedOrigins);
const refreshOverdueAttendance = async () => {
  try {
    const overdueCount = await createOverdueAttendanceNotifications(pool);
    if (overdueCount > 0) {
      const payload = { reason: 'OVERDUE_ATTENDANCE_REFRESH', overdue_count: overdueCount };
      emitToRole('DISCIPLINE_ADMIN', 'notifications:changed', payload);
      emitToRole('DISCIPLINE_OFFICE', 'notifications:changed', payload);
    }
  } catch (error) {
    console.error('Overdue attendance notification refresh failed:', error.message);
  }
};
httpServer.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `🚀 STI Vio-Log API running on http://0.0.0.0:${PORT}`
    );
    console.log(
      `📱 LAN access: http://192.168.100.81:${PORT}`
    );
    refreshOverdueAttendance();
    const overdueAttendanceTimer = setInterval(refreshOverdueAttendance, 5 * 60 * 1000);
    overdueAttendanceTimer.unref();
  }
);
const shutdown=(signal)=>{console.log(JSON.stringify({level:'info',event:'shutdown',signal}));httpServer.close(()=>pool.end().finally(()=>process.exit(0)));setTimeout(()=>process.exit(1),10000).unref();};
process.once('SIGTERM',()=>shutdown('SIGTERM'));
process.once('SIGINT',()=>shutdown('SIGINT'));
}

module.exports = app;
