import test from 'node:test'
import assert from 'node:assert/strict'
import { accountStatusLabel, buildGoogleRecoveryPayload, buildStaffAccountPayload, clearOneTimeSecret, STAFF_ROLES } from '../src/lib/accountAdmin.js'

test('staff creation payload contains only the supported individual-account fields',()=>{const payload=buildStaffAccountPayload({username:' Officer.One ',role:'discipline_office',firstName:' Ada ',lastName:' Lovelace ',employeeNumber:' EMP-1 ',email:' ADA@EXAMPLE.TEST ',isActive:true,password:'secret'});assert.deepEqual(payload,{username:'officer.one',role:'DISCIPLINE_OFFICE',first_name:'Ada',last_name:'Lovelace',employee_number:'EMP-1',email:'ada@example.test'});assert.equal('password' in payload,false);assert.equal('is_active' in payload,false)})

test('generic account UI cannot create Student or Department Head identities',()=>{assert.deepEqual(STAFF_ROLES,['ADMIN','DISCIPLINE_OFFICE'])})

test('one-time credential cleanup removes the secret from state',()=>{assert.equal(clearOneTimeSecret(),null);assert.equal(accountStatusLabel({is_active:true}),'Active');assert.equal(accountStatusLabel({is_active:false}),'Inactive')})

test('Google recovery payload contains only the required normalized reason',()=>{assert.deepEqual(buildGoogleRecoveryPayload(' identity confirmed '),{reason:'identity confirmed'})})
