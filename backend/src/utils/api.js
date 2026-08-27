class ApiError extends Error {
    constructor(statusCode, code, message) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

const errorBody = (code, message) => ({
    success: false,
    message,
    error: { code, message }
});

const sendError = (res, statusCode, code, message) =>
    res.status(statusCode).json(errorBody(code, message));

const errorHandler = (error, req, res, next) => {
    if (res.headersSent) return next(error);
    console.error("Unhandled API error:", error);
    const statusCode = Number(error.statusCode) || 500;
    const code = error.code || (statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED");
    const message = statusCode === 500 ? "An unexpected server error occurred" : error.message;
    return sendError(res, statusCode, code, message);
};

const notFoundHandler = (req, res) =>
    sendError(res, 404, "RESOURCE_NOT_FOUND", "API endpoint not found");

const normalizeErrorResponses = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 400 && body && typeof body === "object") {
            const defaults = { 400: "VALIDATION_ERROR", 401: "AUTH_REQUIRED", 403: "FORBIDDEN", 404: "RESOURCE_NOT_FOUND", 409: "DATABASE_CONFLICT", 500: "INTERNAL_ERROR" };
            const message = typeof body.message === "string" ? body.message : "Request failed";
            const existing = body.error && typeof body.error === "object" ? body.error : null;
            body = { ...body, success: false, message, error: existing || { code: defaults[res.statusCode] || "REQUEST_FAILED", message } };
        }
        return originalJson(body);
    };
    next();
};

module.exports = { ApiError, errorBody, sendError, errorHandler, notFoundHandler, normalizeErrorResponses };
