import { formatProgramCode } from './studentPrograms.mjs'
export { STRANDS } from './studentPrograms.mjs'
export const ACADEMIC_LEVELS = [['COLLEGE','College'],['SENIOR_HIGH_SCHOOL','Senior High School'],['TESDA','TESDA']]
export const academicLevel = (student = {}) => student.academic_level || ([11,12].includes(Number(student.year_level)) ? 'SENIOR_HIGH_SCHOOL' : Number(student.year_level) >= 1 && Number(student.year_level) <= 8 ? 'COLLEGE' : null)
export const isSeniorHigh = (student) => academicLevel(student) === 'SENIOR_HIGH_SCHOOL'
export const academicLevelLabel = (student) => ACADEMIC_LEVELS.find(([code]) => code === academicLevel(student))?.[1] || 'Not recorded'
export const academicProgram = (student) => formatProgramCode((isSeniorHigh(student) ? student.strand : student.program) || 'Not recorded')
export const academicYear = (student) => {
 if (academicLevel(student) === 'TESDA') return 'Not applicable'
 const year = Number(student.year_level)
 if (!Number.isInteger(year) || year < 1) return 'Not recorded'
 return isSeniorHigh(student) ? `Grade ${year}` : `${year}${['','st','nd','rd'][year] || 'th'} Year`
}
export const academicSummary = (student) => [academicLevelLabel(student),academicProgram(student),academicYear(student),student.section].filter(Boolean).join(' / ')
export const yearOptions = (level) => level === 'TESDA' ? [] : level === 'SENIOR_HIGH_SCHOOL' ? [[11,'Grade 11'],[12,'Grade 12']] : [[1,'1st Year'],[2,'2nd Year'],[3,'3rd Year'],[4,'4th Year']]
export const changedAcademicMode = (level) => ({academic_level:level,program:'',strand:'',year_level:''})
