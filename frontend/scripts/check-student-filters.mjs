// Run with Playwright available locally or through NODE_PATH; no app dependency.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const { chromium } = createRequire(import.meta.url)('playwright')
const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../artifacts/student-filters/', import.meta.url))
const user = { id: 1, role: 'DISCIPLINE_ADMIN', full_name: 'Juan Dela Cruz' }
const longProgram = 'Bachelor of Science in Hospitality and Tourism Management'
const students = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1, first_name: index ? `Student ${index}` : 'Maria', last_name: 'Santos',
  student_number: `0200000${String(index).padStart(4, '0')}`, year_level: index % 4 + 1,
  program: index < 6 ? 'BSIT' : index === 6 ? longProgram : `Program ${index}`, section: 'A303'
}))
students[0].year_level = 2
let servedStudents = students
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0 } })
let browser
let attendanceReady = true

try {
  await server.listen()
  const origin = server.resolvedUrls.local[0]
  browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ bypassCSP: true, hasTouch: true })
  page.setDefaultTimeout(20000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) {
      return url.origin === new URL(origin).origin ? route.continue() : route.abort()
    }
    const payloads = {
      '/api/auth/session': { user }, '/api/auth/legal': { legal: { required: false } }, '/api/students': { students: servedStudents },
      '/api/violations': { violations: [{ id: 1, student_id: 1, status: 'OPEN', severity: 'MINOR' }] },
      '/api/violations/types': { violationTypes: [] },
      '/api/community-service': { assignments: [{ id: 1, student_id: 1, status: 'IN_PROGRESS', required_hours: 4, remaining_hours: 2 }] },
      '/api/community-service/active-sessions': { sessions: [{ id: 1, student_id: 1, status: 'ACTIVE', time_in: new Date().toISOString(), time_out: null }] },
      '/api/community-service/assignment-options': { destinations: [] },
      '/api/clearance': { clearanceRecords: [] }, '/api/notifications': { notifications: [], summary: { unread: 0 } }
    }
    const failed = !attendanceReady && url.pathname === '/api/community-service/active-sessions'
    await route.fulfill({ status: failed ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failed ? { message: 'Attendance unavailable' } : payloads[url.pathname] || {}) })
  })
  await page.addInitScript((user) => localStorage.setItem('sti_vio_log_user', JSON.stringify(user)), user)
  await mkdir(output, { recursive: true })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto(`${origin}admin/students`)
  await page.locator('.student-directory-card[aria-busy="false"]').waitFor()
  const field = (name) => page.getByRole('combobox', { name, exact: true })
  const value = (name) => field(name).locator('.student-directory-select-value').innerText()
  const choose = async (name, label) => {
    await field(name).click()
    await page.getByRole('option', { name: label, exact: true }).click()
    assert.equal(await value(name), label)
    assert.equal(await page.getByRole('listbox').count(), 0)
  }
  const clear = () => page.locator('#student-extra-filters').getByRole('button', { name: 'Clear Filters', exact: true }).click()
  await field('Year Level').waitFor()
  await field('Year Level').click()
  assert.deepEqual(await page.getByRole('option').allInnerTexts(), ['All Years', '1st Year', '2nd Year', '3rd Year', '4th Year', 'Senior High School', 'Grade 11', 'Grade 12'], 'All year choices appear with only college records')
  await page.keyboard.press('Escape')
  await field('Program').click()
  for (const label of ['ABM', 'STEM']) assert.equal(await page.getByRole('option', { name: label, exact: true }).count(), 1, `${label} appears once without SHS records`)
  await page.keyboard.press('Escape')
  await field('Year Level').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  assert.equal(await value('Year Level'), 'All Years', 'Arrow navigation must not commit')
  await page.keyboard.press('Escape')
  assert.equal(await value('Year Level'), 'All Years', 'Escape cancels preview')
  assert.equal(await field('Year Level').evaluate((el) => el === document.activeElement), true)
  await page.keyboard.press('Enter')
  await page.keyboard.type('2nd')
  await page.keyboard.press('Enter')
  assert.equal(await value('Year Level'), '2nd Year', 'Typeahead selects the matching year')
  await field('Year Level').press('Enter')
  await page.keyboard.press('Home')
  await page.keyboard.press('Tab')
  assert.equal(await value('Year Level'), 'All Years', 'Tab commits and moves focus')
  assert.equal(await field('Status').evaluate((el) => el === document.activeElement), true)
  await field('Status').press('Space')
  await page.keyboard.press('End')
  await page.keyboard.press('Space')
  assert.equal(await value('Status'), 'Cleared')
  await choose('Status', 'All Statuses')
  await field('Program').press('Enter')
  await page.keyboard.type('BS')
  await page.keyboard.press('Space')
  assert.equal(await value('Program'), 'BSIT', 'Space commits immediately after typeahead')
  assert.equal(await page.getByRole('listbox').count(), 0)
  await choose('Program', 'All Programs')

  await field('Program').click()
  await field('Year Level').click()
  assert.equal(await page.getByRole('listbox').count(), 1, 'Opening another field dismisses the previous menu')
  await page.getByRole('heading', { name: 'Student Directory', exact: true }).click()
  assert.equal(await page.getByRole('listbox').count(), 0, 'Outside click dismisses')
  await field('Program').click()
  await page.keyboard.press('End')
  assert.ok(await page.getByRole('listbox').evaluate((el) => el.scrollTop) > 0, 'Keyboard keeps the active option visible')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Next page', exact: true }).click()
  assert.match(await page.locator('.student-directory-footer').innerText(), /Showing 6–10/)
  await choose('Program', 'BSIT')
  assert.match(await page.locator('.student-directory-footer').innerText(), /Showing 1–5 of 6/)
  await choose('Year Level', '2nd Year')
  await choose('Status', 'Not Cleared')
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await choose('Offense severity', 'Minor')
  await choose('Attendance', 'Currently Timed In')
  await page.locator('.student-directory-card').getByRole('searchbox', { name: 'Search students', exact: true }).fill('Maria')
  assert.match(await page.locator('.student-directory-footer').innerText(), /of 1 students/)
  assert.match(await page.locator('.student-directory-table tbody').innerText(), /Maria Santos/)
  assert.equal(await page.locator('.student-filter-count').innerText(), '2')
  await choose('Status', 'Cleared')
  assert.match(await page.locator('.student-directory-empty').innerText(), /No students match/)
  await clear()
  assert.equal(await value('Program'), 'All Programs')
  assert.equal(await value('Year Level'), 'All Years')
  assert.equal(await value('Status'), 'All Statuses')
  assert.equal(await value('Offense severity'), 'All Severities')
  assert.equal(await value('Attendance'), 'All Attendance')
  assert.equal(await page.locator('.student-filter-count').count(), 0)
  assert.match(await page.locator('.student-directory-footer').innerText(), /Showing 1–5 of 24/)

  for (const [width, height] of [[1920, 1080], [1024, 768], [390, 844]]) {
    await page.setViewportSize({ width, height })
    for (const theme of ['light', 'dark']) {
      await page.evaluate((theme) => { document.documentElement.dataset.theme = theme }, theme)
      await choose('Program', longProgram)
      for (const name of ['Program', 'Year Level', 'Status', 'Offense severity', 'Attendance']) {
        await field(name).click()
        assert.equal(await page.getByRole('listbox').count(), 1, `${name} ${theme} ${width}: menu remains open`)
        const trigger = await field(name).boundingBox()
        const menu = await page.getByRole('listbox').boundingBox().catch(async (error) => {
          console.error(`${name} ${theme} ${width}: menu closed unexpectedly`)
          await page.screenshot({ path: `${output}failure.png` })
          throw error
        })
        assert.ok(Math.abs(menu.width - trigger.width) <= 1, `${name}: field-width menu`)
        assert.ok(menu.x >= 0 && menu.x + menu.width <= width + 1 && menu.y >= 0 && menu.y + menu.height <= height + 1, `${name}: menu inside viewport`)
        assert.ok(trigger.height >= 44, `${name}: touch target`)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No page overflow')
        await page.keyboard.press('Escape')
      }
      await field('Program').click()
      await page.screenshot({ path: `${output}${theme}-${width}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
      await clear()
      if (width === 390) {
        await field('Program').tap()
        await page.getByRole('option', { name: 'BSIT', exact: true }).tap()
        assert.equal(await value('Program'), 'BSIT', 'Touch selection commits')
        await choose('Program', 'All Programs')
        await field('Program').tap()
        await page.locator('.student-directory-table-wrap').evaluate((el) => { el.scrollLeft += 60 })
        await page.getByRole('listbox').waitFor({ state: 'hidden' })
      }
    }
  }

  // Place the field near the viewport bottom to exercise upward opening.
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.evaluate(() => { document.querySelector('.student-directory-toolbar').style.marginTop = '600px' })
  await field('Program').scrollIntoViewIfNeeded()
  await page.evaluate(() => {
    const rect = document.querySelector('.student-directory-select').getBoundingClientRect()
    window.scrollBy(0, rect.bottom - innerHeight + 30)
  })
  await field('Program').click()
  assert.ok((await page.getByRole('listbox').boundingBox()).y < (await field('Program').boundingBox()).y, 'Menu opens above when needed')
  await page.evaluate(() => window.scrollBy(0, 20))
  await page.getByRole('listbox').waitFor({ state: 'hidden' })
  await field('Program').click()
  await page.setViewportSize({ width: 1800, height: 1000 })
  await page.getByRole('listbox').waitFor({ state: 'hidden' })

  attendanceReady = false
  await page.reload()
  await page.locator('.student-directory-card[aria-busy="false"]').waitFor()
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  assert.equal(await field('Attendance').isDisabled(), true, 'Unavailable attendance cannot be selected')
  servedStudents = [...students,
    { id: 25, first_name: 'Grade', last_name: 'Eleven', student_number: '02000111111', academic_level: 'SENIOR_HIGH_SCHOOL', strand: 'STEM', year_level: 11 },
    { id: 26, first_name: 'Grade', last_name: 'Twelve', student_number: '02000122222', strand: 'ABM', year_level: 12 }]
  attendanceReady = true
  await page.reload()
  await page.locator('.student-directory-card[aria-busy="false"]').waitFor()
  assert.match(await page.locator('.student-directory-footer').innerText(), /of 26/)
  await choose('Year Level', 'Senior High School')
  assert.match(await page.locator('.student-directory-footer').innerText(), /of 2 students/)
  await choose('Program', 'ABM')
  assert.match(await page.locator('.student-directory-table tbody').innerText(), /Grade Twelve/)
  await choose('Program', 'All Programs')
  await choose('Year Level', 'Grade 11')
  assert.match(await page.locator('.student-directory-table tbody').innerText(), /Grade Eleven/)
  servedStudents = []
  await page.reload()
  await page.locator('.student-directory-card[aria-busy="false"]').waitFor()
  await field('Year Level').click()
  assert.equal(await page.getByRole('option', { name: 'Grade 12', exact: true }).count(), 1, 'Grade 12 remains available without records')
  await page.keyboard.press('Escape')
  await field('Program').click()
  assert.equal(await page.getByRole('option', { name: 'STEM', exact: true }).count(), 1, 'STEM remains available without records')
  await page.keyboard.press('Escape')
  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log('PASS student filters: selection, keyboard, dismissal, filtering, reset, disabled state, viewport placement, and light/dark desktop/tablet/mobile.')
} finally {
  await browser?.close()
  await server.close()
}
