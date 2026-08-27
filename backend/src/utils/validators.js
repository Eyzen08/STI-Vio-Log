const isValidEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidPhone = (value) => typeof value === "string" && value.trim().length >= 7 && value.trim().length <= 30;

const sanitizeString = (value) => typeof value === "string" ? value.trim() : value;

const isPositiveId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;
const isValidStudentNumber = (value) => typeof value === "string" && /^02000\d{6}$/.test(value.trim());

const parsePagination = (query, { defaultLimit = 25, maxLimit = 100 } = {}) => {
    const page = query.page === undefined ? 1 : Number(query.page);
    const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
        const error = new Error(`page must be a positive integer and limit must be between 1 and ${maxLimit}`);
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
    }
    return { page, limit, offset: (page - 1) * limit };
};

const assertAllowedFields = (body, allowedFields) => {
    const unknown = Object.keys(body || {}).filter((field) => !allowedFields.includes(field));
    if (unknown.length) {
        const error = new Error(`Unsupported field(s): ${unknown.join(", ")}`);
        error.statusCode = 400;
        error.code = "VALIDATION_ERROR";
        throw error;
    }
};

module.exports = {
    isValidEmail,
    isValidPhone,
    sanitizeString,
    isPositiveId,
    isValidStudentNumber,
    parsePagination,
    assertAllowedFields
};
