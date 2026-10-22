import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const components = {}
before(async () => {
  for (const name of ['StudentAcademicFields', 'PhoneInput', 'DepartmentDtr']) {
    const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: `src/components/${name}.jsx`, write: false } })
    const code = bundle.output[0].code.replace(/(from |import )"(react(?:-dom)?(?:\/[^" ]+)?)"/g, (_, prefix, id) => `${prefix}"${import.meta.resolve(id)}"`)
    components[name] = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
  }
})
const render = (name, props) => renderToStaticMarkup(createElement(components[name], props))

test('section examples follow academic level without filling or restricting the section', () => {
  for (const [academic_level, example] of [['COLLEGE', 'A103'], ['SENIOR_HIGH_SCHOOL', 'STEM123']]) {
    const html = render('StudentAcademicFields', { value: { academic_level }, onChange() {} })
    const input = html.match(/<input\b(?=[^>]*name="section")[^>]*>/)[0]
    assert.match(input, new RegExp(`placeholder="e.g. ${example}"`))
    assert.match(input, /value=""/)
    assert.doesNotMatch(input, /pattern=/)
  }
  const legacy = render('StudentAcademicFields', { value: {}, onChange() {}, required: false, legacy: true })
  assert.match(legacy, /<option value="" selected="">Not Recorded<\/option>/)
})

test('phone example is only guidance and existing number formatting remains intact', () => {
  assert.match(render('PhoneInput', { id: 'phone', name: 'phone', value: '' }), /placeholder="e.g. \+63 912 345 6789"[^>]*value=""/)
  assert.match(render('PhoneInput', { id: 'phone', name: 'phone', value: '09123456789' }), /value="\+63 912 345 6789"/)
})

test('DTR distinguishes record IDs from student numbers and explains blank filters', () => {
  const html = render('DepartmentDtr', { report: {}, onFilter() {} })
  assert.match(html, /<input\b(?=[^>]*name="student_id")(?=[^>]*placeholder="e.g. 42")[^>]*>/)
  assert.match(html, /<input\b(?=[^>]*name="assignment_id")(?=[^>]*placeholder="e.g. 105")[^>]*>/)
  assert.match(html, /student record ID.*student number/i)
  assert.match(html, /Leave blank to include all students/)
  assert.match(html, /Leave blank to include all assignments/)
})
