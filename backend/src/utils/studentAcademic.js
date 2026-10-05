const { ApiError } = require('./api');
const { isValidProgram } = require('./validators');
const inferAcademicLevel = (row = {}) => row.academic_level || ([11,12].includes(Number(row.year_level)) ? 'SENIOR_HIGH_SCHOOL' : Number(row.year_level) >= 1 && Number(row.year_level) <= 8 ? 'COLLEGE' : null);
const normalizeAcademic = (input = {}, { legacy = false } = {}) => {
 const academic_level = String(input.academic_level === undefined ? 'COLLEGE' : input.academic_level).trim().toUpperCase();
 const strand = String(input.strand || '').trim().toUpperCase() || null;
 const program = String(input.program || '').trim().toUpperCase() || null;
 const section = String(input.section || '').normalize('NFKC').trim().slice(0,100);
 const year_level = Number(input.year_level);
 if (!['COLLEGE','SENIOR_HIGH_SCHOOL'].includes(academic_level)) throw new ApiError(400,'INVALID_ACADEMIC_LEVEL','Select College or Senior High School');
 if (!section) throw new ApiError(400,'SECTION_REQUIRED','Enter the student section');
 if (academic_level === 'COLLEGE') {
  if (!program) throw new ApiError(400,'PROGRAM_REQUIRED','Select a valid college program');
  if (!isValidProgram(program)) throw new ApiError(400,'INVALID_PROGRAM','Select a valid college program');
  if (strand) throw new ApiError(400,'INVALID_STRAND','College students do not have an SHS strand');
  if (!Number.isInteger(year_level) || year_level < 1 || year_level > (legacy ? 8 : 4)) throw new ApiError(400,'INVALID_YEAR_LEVEL','College year level must be between 1 and 4');
 } else {
  if (!['ABM','STEM'].includes(strand) && !(legacy && strand === null)) throw new ApiError(400,'INVALID_STRAND','Select ABM or STEM');
  if (![11,12].includes(year_level)) throw new ApiError(400,'INVALID_YEAR_LEVEL','Select Grade 11 or Grade 12');
 }
 return {academic_level,strand:academic_level === 'COLLEGE' ? null : strand,program:academic_level === 'COLLEGE' ? program : null,section,year_level};
};
module.exports = {inferAcademicLevel,normalizeAcademic};
