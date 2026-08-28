require("dotenv").config();

const express = require("express");
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
const googleDepartmentRegistrationRoutes = require('./routes/googleDepartmentRegistrationRoutes');
const accountRoutes = require('./routes/accountRoutes');
const accountAdministrationRoutes = require('./routes/accountAdministrationRoutes');
const departmentAdministrationRoutes = require('./routes/departmentAdministrationRoutes');
const pool = require("./config/database");
const { errorHandler, notFoundHandler, normalizeErrorResponses } = require("./utils/api");

const {
  authenticateToken,
  authorizeRoles
} = require("./middleware/authMiddleware");

const {
  getMyCommunityServiceAssignment
} = require("./controllers/communityServiceController");

const app = express();

const PORT = process.env.PORT || 5000;


// =====================================================
// SECURE CONFIGURATION VALIDATION
// =====================================================

const validateSecureConfig = () => {
  const jwtSecret = process.env.JWT_SECRET;

  const requiredDbValues = [
    process.env.DB_HOST,
    process.env.DB_PORT,
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD
  ];

  const insecureDefaults = [
    "sti-vio-log-dev-secret-change-me",
    "change-this-to-a-long-random-secret"
  ];

  if (
    !jwtSecret ||
    insecureDefaults.includes(jwtSecret) ||
    jwtSecret.length < 32
  ) {
    throw new Error(
      "JWT_SECRET must be set to a strong value in the environment before launch."
    );
  }

  if (requiredDbValues.some((value) => !value)) {
    throw new Error(
      "Missing required database environment variables before launch."
    );
  }
};


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

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173"
];

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  defaultAllowedOrigins.join(",")
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .concat(defaultAllowedOrigins)
  .filter(
    (value, index, array) =>
      array.indexOf(value) === index
  );


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

      callback(
        new Error(
          "Origin not allowed by CORS"
        )
      );
    },

    credentials: true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(
  express.json({
    limit: "1mb"
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

app.use('/api/account', authenticateToken, accountRoutes);

app.use('/api/admin/accounts', authenticateToken, authorizeRoles('ADMIN'), accountAdministrationRoutes);
app.use('/api/admin/departments', authenticateToken, authorizeRoles('ADMIN'), departmentAdministrationRoutes);


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
    "DEPARTMENT_HEAD",
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
    "DEPARTMENT_HEAD"
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

app.use(
  '/api/admin/google-department-registrations',
  authenticateToken,
  authorizeRoles('ADMIN'),
  googleDepartmentRegistrationRoutes
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
app.listen(
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
