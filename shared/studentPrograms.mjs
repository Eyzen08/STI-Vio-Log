export const COLLEGE_PROGRAMS = Object.freeze({
  BSCS: 'Bachelor of Science in Computer Science',
  BSIT: 'Bachelor of Science in Information Technology',
  BSCPE: 'Bachelor of Science in Computer Engineering',
  BSA: 'Bachelor of Science in Accountancy',
  BSBA: 'Bachelor of Science in Business Administration',
  BSAIS: 'Bachelor of Science in Accounting Information Systems',
  BSHM: 'Bachelor of Science in Hospitality Management',
  BACOMM: 'Bachelor of Arts in Communication',
  BSTM: 'Bachelor of Science in Tourism Management',
  BSOA: 'Bachelor of Science in Office Administration'
})

export const STRANDS = [
  ['ABM', 'Accountancy, Business, and Management'],
  ['STEM', 'Science, Technology, Engineering, and Mathematics'],
  ['STEM-ETM', 'Science, Technology, Engineering, and Mathematics – Engineering, Technology, and Mathematics'],
  ['B&E', 'Business and Entrepreneurship']
]

export const TESDA_PROGRAMS = Object.freeze({
  'DCA-DSAI-II': 'Data Collection and Annotation – Data Science-Artificial Intelligence (Level II)',
  'AIPA-III': 'AI Prompting and Automation (Level III)'
})

export const PROGRAM_NAMES = Object.freeze({...Object.fromEntries(STRANDS), ...COLLEGE_PROGRAMS, ...TESDA_PROGRAMS})
export const formatProgramCode = (code) => code === 'BSCPE' ? 'BSCpE' : code
export const formatProgramName = (value, fallback = 'Program not recorded') => {
  const program = String(value || '').trim()
  if (!program) return fallback
  return Object.hasOwn(PROGRAM_NAMES, program.toUpperCase()) ? PROGRAM_NAMES[program.toUpperCase()] : program
}
