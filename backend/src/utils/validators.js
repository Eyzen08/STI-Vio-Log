const isValidEmail = (value) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isValidPhone = (value) => typeof value === "string" && value.trim().length >= 7 && value.trim().length <= 30;

const sanitizeString = (value) => typeof value === "string" ? value.trim() : value;

module.exports = {
    isValidEmail,
    isValidPhone,
    sanitizeString
};
