import test from 'node:test'
import assert from 'node:assert/strict'
import { duplicateSummaryTotal, duplicateTypeLabel } from '../src/lib/duplicateReview.js'
import { APP_ROUTES, resolveRoute } from '../src/lib/routes.js'

test('duplicate review labels safe conflict categories',()=>{assert.equal(duplicateTypeLabel('STUDENT_NUMBER'),'Student number');assert.equal(duplicateTypeLabel('GOOGLE_IDENTITY'),'Google identity');assert.equal(duplicateSummaryTotal({total:'3'}),3)})
test('duplicate review legacy route is discipline-admin-only and opens the combined workspace',()=>{const route=APP_ROUTES.find(item=>item.path==='/admin/duplicate-review');assert.deepEqual(route.roles,['DISCIPLINE_ADMIN']);assert.equal(route.navigation,false);assert.equal(resolveRoute(route.path,'DISCIPLINE_ADMIN').redirectTo,'/admin/registrations');assert.equal(resolveRoute(route.path,'DISCIPLINE_OFFICE').status,'unauthorized')})
