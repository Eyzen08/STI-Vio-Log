const { ApiError } = require('./api');
const { isValidProgram } = require('./validators');
const { STRANDS, TESDA_PROGRAMS } = require('../../../shared/studentPrograms.mjs');
const { ACADEMIC_LEVELS } = require('../../../shared/studentAcademic.mjs');
const inferAcademicLevel = (row = {}) => row.academic_level || ([11,12].includes(Number(row.year_level)) ? 'SENIOR_HIGH_SCHOOL' : Number(row.year_level) >= 1 && Number(row.year_level) <= 8 ? 'COLLEGE' : null);
const normalizeAcademic = (input = {}, { legacy = false } = {}) => {
 const academic_level = String(input.academic_level === undefined ? 'COLLEGE' : input.academic_level).trim().toUpperCase();
 const strand = String(input.strand || '').trim().toUpperCase() || null;
 const program = String(input.program || '').trim().toUpperCase() || null;
 const section = String(input.section || '').normalize('NFKC').trim().slice(0,100);
 const year_level = academic_level === 'TESDA' ? null : Number(input.year_level);
 if (!ACADEMIC_LEVELS.some(([code]) => code === academic_level)) throw new ApiError(400,'INVALID_ACADEMIC_LEVEL','Select College, Senior High School, or TESDA');
 if (!section) throw new ApiError(400,'SECTION_REQUIRED','Enter the student section');
 if (academic_level === 'COLLEGE') {
  if (!program) throw new ApiError(400,'PROGRAM_REQUIRED','Select a valid college program');
  if (!isValidProgram(program)) throw new ApiError(400,'INVALID_PROGRAM','Select a valid college program');
  if (strand) throw new ApiError(400,'INVALID_STRAND','College students do not have an SHS strand');
  if (!Number.isInteger(year_level) || year_level < 1 || year_level > (legacy ? 8 : 4)) throw new ApiError(400,'INVALID_YEAR_LEVEL','College year level must be between 1 and 4');
 } else if (academic_level === 'TESDA') {
  if (!program) throw new ApiError(400,'PROGRAM_REQUIRED','Select a valid TESDA program');
  if (!Object.hasOwn(TESDA_PROGRAMS,program)) throw new ApiError(400,'INVALID_PROGRAM','Select a valid TESDA program');
  if (strand) throw new ApiError(400,'INVALID_STRAND','TESDA students do not have an SHS strand');
  if (input.year_level !== undefined && input.year_level !== null && input.year_level !== '') throw new ApiError(400,'INVALID_YEAR_LEVEL','TESDA programs do not have a school year level');
 } else {
  if (!STRANDS.some(([code]) => code === strand) && !(legacy && strand === null)) throw new ApiError(400,'INVALID_STRAND','Select a valid SHS strand');
  if (![11,12].includes(year_level)) throw new ApiError(400,'INVALID_YEAR_LEVEL','Select Grade 11 or Grade 12');
 }
 return {academic_level,strand:academic_level === 'SENIOR_HIGH_SCHOOL' ? strand : null,program:academic_level === 'SENIOR_HIGH_SCHOOL' ? null : program,section,year_level};
};
module.exports = {inferAcademicLevel,normalizeAcademic};
