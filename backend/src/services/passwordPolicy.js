const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

const passwordRequirements = (value) => {
  const password = typeof value === 'string' ? value : '';
  return {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
};

const passwordIsStrong = (value) => Object.values(passwordRequirements(value)).every(Boolean);

module.exports = { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, passwordRequirements, passwordIsStrong };

