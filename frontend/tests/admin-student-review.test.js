import test from 'node:test'
import assert from 'node:assert/strict'
import { filterAdminStudents, summarizeStudentCondition } from '../src/lib/adminStudentReview.js'

const students=[{id:1,student_number:'02000123456',first_name:'Juan',last_name:'Dela Cruz',program:'BSIT',section:'A103'},{id:2,student_number:'02000999999',first_name:'Maria',last_name:'Santos',program:'BSTM',section:'B201'}]
test('admin student search matches number, name, program, or section',()=>{assert.deepEqual(filterAdminStudents(students,'dela').map(x=>x.id),[1]);assert.deepEqual(filterAdminStudents(students,'A103').map(x=>x.id),[1]);assert.equal(filterAdminStudents(students,'020009').length,1)})
test('student condition summarizes only that students violation history',()=>{assert.deepEqual(summarizeStudentCondition(1,[{student_id:1,status:'OPEN',required_service_hours:4,completed_service_hours:1},{student_id:1,status:'COMPLETE',required_service_hours:2,completed_service_hours:2},{student_id:2,status:'OPEN',required_service_hours:9}]),{records:[{student_id:1,status:'OPEN',required_service_hours:4,completed_service_hours:1},{student_id:1,status:'COMPLETE',required_service_hours:2,completed_service_hours:2}],total:2,open:1,resolved:1,requiredHours:4,remainingHours:3,condition:'Requires action'})})
