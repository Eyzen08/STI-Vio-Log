const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const COMMON_PASSWORDS=new Set(['password123!','password@123','qwerty123!','admin123!','welcome123!','letmein123!','student123!']);

const passwordRequirements = (value) => {
  const password = typeof value === 'string' ? value : '';
  return {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    uncommon: !COMMON_PASSWORDS.has(password.normalize('NFKC').toLowerCase())
  };
};

const passwordIsStrong = (value) => Object.values(passwordRequirements(value)).every(Boolean);

module.exports = { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH, passwordRequirements, passwordIsStrong };
