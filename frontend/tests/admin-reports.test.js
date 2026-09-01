import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAdminReportQuery, defaultReportSort, reportSortOptions } from '../src/lib/adminReports.js'

test('DTR report maps date filters to its from/to API contract',()=>{assert.equal(buildAdminReportQuery('dtr',{student_id:'4',from_date:'2026-08-01',to_date:'2026-08-31',status:'OPEN',sort_by:'date_desc'}),'student_id=4&from=2026-08-01&to=2026-08-31')})
test('each report sends only its supported sort contract',()=>{assert.equal(buildAdminReportQuery('non-compliance',{sort_by:'hours',status:'OPEN',student_id:''}),'sort_by=hours');assert.equal(buildAdminReportQuery('good-standing',{sort_by:'name',from_date:'2026-01-01'}),'sort_by=name');assert.deepEqual(reportSortOptions('community-service'),['hours_desc','hours_asc','status']);assert.equal(defaultReportSort('parent-contacts'),'date_desc')})

test('non-compliance report does not send an unsupported internal student filter',()=>{assert.equal(buildAdminReportQuery('non-compliance',{student_id:'42',sort_by:'date'}),'sort_by=date')})
