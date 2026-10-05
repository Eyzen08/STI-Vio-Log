import test from 'node:test'
import assert from 'node:assert/strict'
import {academicLevel,academicProgram,academicYear,academicSummary,yearOptions,changedAcademicMode} from '../src/lib/studentAcademic.js'
import {filterAdminStudents} from '../src/lib/adminStudentReview.js'
import {reportCell} from '../src/lib/reportPresentation.js'
test('academic presentation displays SHS strand and Grade instead of missing College program',()=>{
 const shs={academic_level:'SENIOR_HIGH_SCHOOL',strand:'STEM',year_level:12,section:'STEM12-A'}
 assert.equal(academicProgram(shs),'STEM');assert.equal(academicYear(shs),'Grade 12');assert.match(academicSummary(shs),/Senior High School/)
 assert.equal(academicYear({year_level:2}),'Year 2');assert.equal(academicLevel({year_level:11}),'SENIOR_HIGH_SCHOOL')
 assert.equal(academicProgram({...shs,strand:null,program:'OLD'}),'Not recorded')
 assert.equal(filterAdminStudents([shs],'stem').length,1)
 assert.equal(reportCell('year_level',11),'Grade 11')
})
test('academic form choices and mode changes clear incompatible draft fields',()=>{
 assert.deepEqual(yearOptions('SENIOR_HIGH_SCHOOL').map(([v])=>v),[11,12])
 assert.deepEqual(yearOptions('COLLEGE').map(([v])=>v),[1,2,3,4])
 assert.deepEqual(changedAcademicMode('COLLEGE'),{academic_level:'COLLEGE',program:'',strand:'',year_level:''})
})
