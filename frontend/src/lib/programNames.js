const PROGRAM_NAMES = Object.freeze({
  BSCS: 'Bachelor of Science in Computer Science',
  BSIT: 'Bachelor of Science in Information Technology',
  BSA: 'Bachelor of Science in Accountancy',
  BSBA: 'Bachelor of Science in Business Administration',
  BSHM: 'Bachelor of Science in Hospitality Management',
  BSTM: 'Bachelor of Science in Tourism Management',
  BSOA: 'Bachelor of Science in Office Administration'
})

export const formatProgramName = (value, fallback = 'Program not recorded') => {
  const program = String(value || '').trim()
  if (!program) return fallback
  return PROGRAM_NAMES[program.toUpperCase()] || program
}

export { PROGRAM_NAMES }
