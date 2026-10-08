export const STRANDS = [['ABM','Accountancy, Business, and Management'],['STEM','Science, Technology, Engineering, and Mathematics']]
export const academicLevel = (student = {}) => student.academic_level || ([11,12].includes(Number(student.year_level)) ? 'SENIOR_HIGH_SCHOOL' : Number(student.year_level) >= 1 && Number(student.year_level) <= 8 ? 'COLLEGE' : null)
export const isSeniorHigh = (student) => academicLevel(student) === 'SENIOR_HIGH_SCHOOL'
export const academicLevelLabel = (student) => academicLevel(student) === 'COLLEGE' ? 'College' : isSeniorHigh(student) ? 'Senior High School' : 'Not recorded'
export const academicProgram = (student) => (isSeniorHigh(student) ? student.strand : student.program) || 'Not recorded'
export const academicYear = (student) => student.year_level ? (isSeniorHigh(student) ? 'Grade ' : 'Year ') + student.year_level : 'Not recorded'
export const academicSummary = (student) => [academicLevelLabel(student),academicProgram(student),academicYear(student),student.section].filter(Boolean).join(' / ')
export const yearOptions = (level) => level === 'SENIOR_HIGH_SCHOOL' ? [[11,'Grade 11'],[12,'Grade 12']] : [[1,'1st Level'],[2,'2nd Level'],[3,'3rd Level'],[4,'4th Level']]
export const changedAcademicMode = (level) => ({academic_level:level,program:'',strand:'',year_level:''})
