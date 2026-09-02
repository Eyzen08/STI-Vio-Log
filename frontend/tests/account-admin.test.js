import test from 'node:test'
import assert from 'node:assert/strict'
import { accountStatusLabel, ASSIGNABLE_STAFF_ROLES, buildAccountAssignmentPayload, buildGoogleRecoveryPayload, buildStaffAccountPayload, clearOneTimeSecret, STAFF_ROLES } from '../src/lib/accountAdmin.js'

test('staff creation payload contains only the supported individual-account fields',()=>{const payload=buildStaffAccountPayload({username:' Officer.One ',role:'discipline_office',firstName:' Ada ',lastName:' Lovelace ',employeeNumber:' EMP-1 ',email:' ADA@EXAMPLE.TEST ',isActive:true,password:'secret'});assert.deepEqual(payload,{username:'officer.one',role:'DISCIPLINE_OFFICE',first_name:'Ada',last_name:'Lovelace',employee_number:'EMP-1',email:'ada@example.test'});assert.equal('password' in payload,false);assert.equal('is_active' in payload,false)})

test('Admin staff creation exposes only approved staff roles',()=>{assert.deepEqual(STAFF_ROLES,['DISCIPLINE_OFFICE','DEPARTMENT_HEAD'])})

test('Department Head creation includes its required department scope',()=>{const payload=buildStaffAccountPayload({username:'library.account',role:'DEPARTMENT_HEAD',firstName:'Library',lastName:'Account',departmentId:'7'});assert.equal(payload.department_id,7)})

test('one-time credential cleanup removes the secret from state',()=>{assert.equal(clearOneTimeSecret(),null);assert.equal(accountStatusLabel({is_active:true}),'Active');assert.equal(accountStatusLabel({is_active:false}),'Inactive')})

test('Google recovery payload contains only the required normalized reason',()=>{assert.deepEqual(buildGoogleRecoveryPayload(' identity confirmed '),{reason:'identity confirmed'})})

test('role assignment requires department scope only for Department Heads',()=>{assert.deepEqual(ASSIGNABLE_STAFF_ROLES,['DISCIPLINE_OFFICE','DEPARTMENT_HEAD']);assert.deepEqual(buildAccountAssignmentPayload({role:'department_head',departmentId:'7',reason:' library assignment '}),{role:'DEPARTMENT_HEAD',department_id:7,reason:'library assignment'});assert.deepEqual(buildAccountAssignmentPayload({role:'discipline_office',departmentId:'7',reason:' reassigned '}),{role:'DISCIPLINE_OFFICE',department_id:null,reason:'reassigned'})})
