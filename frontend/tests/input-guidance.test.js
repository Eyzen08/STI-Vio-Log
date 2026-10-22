import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build } from 'vite'
import react from '@vitejs/plugin-react'

const components = {}
before(async () => {
  for (const name of ['StudentAcademicFields', 'StudentOnboarding', 'PhoneInput', 'DepartmentDtr']) {
    const bundle = await build({ configFile: false, plugins: [react()], logLevel: 'silent', build: { ssr: `src/components/${name}.jsx`, write: false } })
    const code = bundle.output[0].code.replace(/(from |import )"(react(?:-dom)?(?:\/[^" ]+)?)"/g, (_, prefix, id) => `${prefix}"${import.meta.resolve(id)}"`)
    components[name] = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
  }
})
const render = (name, props) => renderToStaticMarkup(createElement(components[name], props))

test('academic forms show category-specific programs and no TESDA year field', () => {
  const college=render('StudentAcademicFields',{value:{academic_level:'COLLEGE'},onChange(){}})
  for (const code of ['BSCPE','BSAIS','BACOMM']) assert.equal(college.split(`value="${code}"`).length-1,1)
  assert.match(college,/BSCpE — Bachelor of Science in Computer Engineering/)
  assert.doesNotMatch(college,/<option value="(?:ABM|STEM|AIPA-III|DCA-DSAI-II)"/)
  const shs=render('StudentAcademicFields',{value:{academic_level:'SENIOR_HIGH_SCHOOL'},onChange(){}})
  for (const code of ['ABM','STEM','STEM-ETM','B&amp;E']) assert.equal(shs.split(`value="${code}"`).length-1,1)
  const tesda=render('StudentAcademicFields',{value:{academic_level:'TESDA'},onChange(){}})
  for (const code of ['DCA-DSAI-II','AIPA-III']) assert.equal(tesda.split(`value="${code}"`).length-1,1)
  assert.doesNotMatch(tesda,/name="year_level"|<option value="BSIT"/)
  assert.match(tesda,/name="section"/)
})

test('onboarding offers TESDA programs without requiring a school year', (t) => {
  const previous=globalThis.window
  globalThis.window={location:{pathname:'/student/onboarding',search:'',hash:''}}
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous})
  const html=render('StudentOnboarding',{user:{onboarding_step:'PROFILE'},draft:{screen:'ACADEMIC',profile:{academicLevel:'TESDA',program:'AIPA-III',section:'',yearLevel:''}}})
  assert.match(html,/<input\b(?=[^>]*value="TESDA")(?=[^>]*checked)[^>]*>/)
  assert.match(html,/<option value="AIPA-III" selected="">/)
  assert.match(html,/Data Collection and Annotation/)
  assert.doesNotMatch(html,/Select Year Level|Select Grade Level|<option value="BSIT"/)
})

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
