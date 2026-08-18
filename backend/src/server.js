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

const {
  authenticateToken,
  authorizeRoles
} = require("./middleware/authMiddleware");

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


// =====================================================
// PUBLIC AUTH ROUTES
// =====================================================

app.use(
  "/api",
  authRoutes
);


// =====================================================
// STUDENT ROUTES
// =====================================================
// Existing student routes are accessible to students
// as well as authorized administrative roles.
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
    "ADMIN",
    "DISCIPLINE_OFFICE"
  ),
  departmentHeadRoutes
);


// =====================================================
// VIOLATIONS
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
    "DEPARTMENT_HEAD",
    "DISCIPLINE_OFFICE"
  ),
  qrRoutes
);


// =====================================================
// GENERAL CLEARANCE
// =====================================================
// Used by:
// - ADMIN
// - DISCIPLINE_OFFICE
// - DEPARTMENT_HEAD
//
// Students do NOT have access to this general CRUD API.
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
// STUDENT ONLY.
//
// The controller uses req.user.id and the students.user_id
// relationship to find the logged-in student's own records.
//
// A student cannot provide another student's ID.
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
  authorizeRoles(
    "ADMIN",
    "DISCIPLINE_OFFICE"
  ),
  auditRoutes
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
  (req, res) => {
    return res.json({
      success: true,
      message:
        "Backend is healthy"
    });
  }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log(
      `🚀 STI Vio-Log API running on http://localhost:${PORT}`
    );
  }
);