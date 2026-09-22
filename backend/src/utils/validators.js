const isValidEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const normalizePhone = (value) => {
    if (typeof value !== "string") return null;
    const compact = value.trim().replace(/[\s()-]/g, "");
    if (/^09\d{9}$/.test(compact)) return `+63${compact.slice(1)}`;
    if (/^\+639\d{9}$/.test(compact)) return compact;
    return null;
};

const isValidPhone = (value) => normalizePhone(value) !== null;

const sanitizeString = (value) => typeof value === "string" ? value.trim() : value;

const isPositiveId = (value) => /^\d+$/.test(String(value)) && Number(value) > 0;
const isValidStudentNumber = (value) => typeof value === "string"
    && /^\d{11}$/.test(value.trim());

const PROGRAM_CODES = new Set(["BSCS", "BSIT", "BSA", "BSBA", "BSHM", "BSTM", "BSOA"]);
const isValidProgram = (value) => typeof value === "string" && PROGRAM_CODES.has(value.trim().toUpperCase());

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
    normalizePhone,
    sanitizeString,
    isPositiveId,
    isValidStudentNumber,
    isValidProgram,
    parsePagination,
    assertAllowedFields
};
