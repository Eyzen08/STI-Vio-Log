require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

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
const pool = require("./config/database");
const { allowedOriginsFor, CORS_METHODS, validateSecureConfig } = require('./config/security');
const { errorHandler, notFoundHandler, normalizeErrorResponses } = require("./utils/api");
const { initializeRealtime } = require('./realtime');

const {
  authenticateToken,
  authorizeRoles
} = require("./middleware/authMiddleware");

const {
  getMyCommunityServiceAssignment
} = require("./controllers/communityServiceController");

const app = express();

if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

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

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
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
      "Authorization"
    ]
  })
);

app.use(
  express.json({
    limit: "2mb"
  })
);

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
app.use('/api/messages', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE', 'DEPARTMENT_HEAD', 'STUDENT'), messageRoutes);

app.use('/api/account', authenticateToken, accountRoutes);

app.use('/api/admin/accounts', authenticateToken, authorizeRoles('ADMIN'), accountAdministrationRoutes);
app.use('/api/department-accounts', authenticateToken, authorizeRoles('ADMIN'), require('./routes/departmentAccountRoutes'));
app.use('/api/admin/departments', authenticateToken, authorizeRoles('ADMIN'), departmentAdministrationRoutes);
app.use('/api/admin/students', authenticateToken, authorizeRoles('ADMIN', 'DISCIPLINE_OFFICE'), googleLinkAdministrationRoutes);
app.use('/api/admin/duplicate-review', authenticateToken, authorizeRoles('ADMIN'), duplicateAccountReviewRoutes);


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
  authorizeRoles(
    "ADMIN",
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
    "ADMIN"
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
  authorizeRoles(
    "ADMIN",
    "DISCIPLINE_OFFICE"
  ),
  violationRoutes
);


// =====================================================
// COMMUNITY SERVICE
// =====================================================

// -----------------------------------------------------
// STUDENT COMMUNITY SERVICE
// -----------------------------------------------------
// Students can only access their own community-service
// assignment through this endpoint.
// -----------------------------------------------------

app.get(
  "/api/community-service/my-assignment",
  authenticateToken,
  authorizeRoles("STUDENT"),
  require("./controllers/communityServiceController")
    .getMyCommunityServiceAssignment
);


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
  authorizeRoles(
    "ADMIN",
    "DISCIPLINE_OFFICE",
    "DEPARTMENT_HEAD"
  ),
  communityServiceRoutes
);

app.use(
  "/api/parent-contact",
  authenticateToken,
  authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
  parentContactRoutes
);


// =====================================================
// QR
// =====================================================

app.use(
  "/api/qr",
  authenticateToken,
  authorizeRoles(
    "ADMIN",
    "DEPARTMENT_HEAD",
    "DISCIPLINE_OFFICE"
  ),
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
  authorizeRoles(
    "ADMIN",
    "DISCIPLINE_OFFICE",
  ),
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
  authorizeRoles("ADMIN"),
  auditRoutes
);

app.use(
  "/api/google-registrations",
  authenticateToken,
  authorizeRoles("ADMIN", "DISCIPLINE_OFFICE"),
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
initializeRealtime(httpServer, allowedOrigins);
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
  }
);
}

module.exports = app;
